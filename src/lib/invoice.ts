import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

const PROVIDER_LABEL: Record<string, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  MANUAL: "Manual",
};

const FONT_NAME = "Montserrat";

export type InvoiceData = {
  invoiceNumber: string;
  paidAt: Date;
  amount: number;
  currency: string;
  provider: string;
  paymentReference?: string | null;
  description?: string | null;
  brand?: {
    name: string;
    logo?: string | null;
    primaryColor?: string | null;
    tagline?: string | null;
  } | null;
  client: {
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    country?: string | null;
  };
};

type PdfImage = { data: string; format: "PNG" | "JPEG" | "WEBP" | "GIF" };

function invoiceNumberFor(transactionId: string) {
  return `INV-${transactionId.slice(-10).toUpperCase()}`;
}

function hexToRgb(hex?: string | null): [number, number, number] {
  const clean = (hex || "#2d9a84").replace("#", "");
  if (clean.length !== 6 || /[^0-9a-f]/i.test(clean)) return [45, 154, 132];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mixWithWhite(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map((channel) => Math.round(channel + (255 - channel) * amount)) as [
    number,
    number,
    number,
  ];
}

function descriptionFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).description;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const brandSelect = {
  name: true,
  logo: true,
  primaryColor: true,
  tagline: true,
} as const;

export function invoiceFromTransaction(transaction: {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  externalId?: string | null;
  createdAt: Date;
  metadata?: unknown;
  client: InvoiceData["client"];
  paymentLink?: {
    description?: string | null;
    brand?: InvoiceData["brand"];
  } | null;
}): InvoiceData {
  return {
    invoiceNumber: invoiceNumberFor(transaction.id),
    paidAt: transaction.createdAt,
    amount: transaction.amount,
    currency: transaction.currency,
    provider: transaction.provider,
    paymentReference: transaction.externalId,
    description:
      transaction.paymentLink?.description || descriptionFromMetadata(transaction.metadata),
    brand: transaction.paymentLink?.brand || null,
    client: transaction.client,
  };
}

export async function getCompletedTransactionInvoice(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      client: {
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          country: true,
        },
      },
      paymentLink: {
        select: {
          description: true,
          brand: { select: brandSelect },
        },
      },
    },
  });

  if (!transaction) return null;
  if (transaction.status !== "COMPLETED") return { notPaid: true as const, transaction };
  return { invoice: invoiceFromTransaction(transaction), transaction };
}

export async function getPaymentLinkInvoice(paymentLinkId: string) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id: paymentLinkId },
    select: { id: true, status: true },
  });

  if (!paymentLink) return null;

  const transaction = await prisma.transaction.findFirst({
    where: { paymentLinkId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          country: true,
        },
      },
      paymentLink: {
        select: {
          description: true,
          brand: { select: brandSelect },
        },
      },
    },
  });

  if (!transaction) return { paymentLink, notPaid: true as const };
  return { paymentLink, invoice: invoiceFromTransaction(transaction), transaction };
}

function mimeToFormat(mime: string): PdfImage["format"] | null {
  const type = mime.toLowerCase().split(";")[0].trim();
  if (type === "image/png") return "PNG";
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg" || type === "image/jfif") {
    return "JPEG";
  }
  if (type === "image/webp") return "WEBP";
  if (type === "image/gif") return "GIF";
  return null;
}

function imageFromBuffer(buffer: Buffer, mime: string): PdfImage | null {
  const format = mimeToFormat(mime);
  if (!format || buffer.length === 0) return null;
  return { format, data: buffer.toString("base64") };
}

/** Same stored brand.logo value the pay page serves through /api/brands/[id]/logo */
async function resolvePayPageBrandLogo(logo?: string | null): Promise<PdfImage | null> {
  if (!logo) return null;

  if (logo.startsWith("data:")) {
    const match = logo.match(/^data:([^;,]+);base64,(.+)$/i);
    if (!match) return null;
    return imageFromBuffer(Buffer.from(match[2], "base64"), match[1]);
  }

  if (logo.startsWith("http://") || logo.startsWith("https://")) {
    try {
      const response = await fetch(logo);
      if (!response.ok) return null;
      const mime = response.headers.get("content-type") || "image/png";
      return imageFromBuffer(Buffer.from(await response.arrayBuffer()), mime);
    } catch {
      return null;
    }
  }

  const relative = logo.replace(/^\//, "").split("?")[0];
  const publicPath = path.join(process.cwd(), "public", relative);
  if (fs.existsSync(publicPath)) {
    const ext = path.extname(publicPath).toLowerCase();
    const mime =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/png";
    return imageFromBuffer(fs.readFileSync(publicPath), mime);
  }

  return null;
}

function fontPath(fileName: string) {
  return [
    path.join(process.cwd(), "src", "fonts", fileName),
    path.join(process.cwd(), "public", "fonts", fileName),
  ].find((candidate) => fs.existsSync(candidate));
}

function registerMontserrat(doc: jsPDF) {
  const regularPath = fontPath("Montserrat-Regular.ttf");
  const boldPath = fontPath("Montserrat-Bold.ttf");
  if (!regularPath || !boldPath) return false;

  doc.addFileToVFS("Montserrat-Regular.ttf", fs.readFileSync(regularPath).toString("base64"));
  doc.addFont("Montserrat-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", fs.readFileSync(boldPath).toString("base64"));
  doc.addFont("Montserrat-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
  return true;
}

function setInvoiceFont(doc: jsPDF, style: "normal" | "bold", size?: number) {
  const font = doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica";
  doc.setFont(font, style);
  if (size) doc.setFontSize(size);
}

function drawBrandLogo(doc: jsPDF, image: PdfImage, x: number, y: number, maxW: number, maxH: number) {
  const dataUrl = `data:image/${image.format.toLowerCase()};base64,${image.data}`;
  const props = doc.getImageProperties(dataUrl);
  const ratio = props.width / Math.max(props.height, 1);
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  doc.addImage(dataUrl, image.format, x, y, width, height);
  return { width, height };
}

export async function buildInvoicePdf(invoice: InvoiceData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerMontserrat(doc);

  const accent = hexToRgb(invoice.brand?.primaryColor);
  const accentSoft = mixWithWhite(accent, 0.88);
  const brandName = invoice.brand?.name || "Invoice";
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await resolvePayPageBrandLogo(invoice.brand?.logo);

  let headerBottom = 18;
  if (logo) {
    try {
      const placed = drawBrandLogo(doc, logo, 14, 12, 72, 22);
      headerBottom = Math.max(headerBottom, 12 + placed.height);
    } catch {
      setInvoiceFont(doc, "bold", 18);
      doc.setTextColor(15, 23, 42);
      doc.text(brandName, 14, 22);
      headerBottom = 22;
    }
  } else {
    setInvoiceFont(doc, "bold", 18);
    doc.setTextColor(15, 23, 42);
    doc.text(brandName, 14, 22);
    if (invoice.brand?.tagline) {
      setInvoiceFont(doc, "normal", 9);
      doc.setTextColor(100, 116, 139);
      doc.text(invoice.brand.tagline, 14, 28);
      headerBottom = 30;
    } else {
      headerBottom = 24;
    }
  }

  setInvoiceFont(doc, "bold", 22);
  doc.setTextColor(...accent);
  doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

  const paidLabel = "PAID";
  setInvoiceFont(doc, "bold", 8);
  const paidWidth = doc.getTextWidth(paidLabel) + 8;
  doc.setFillColor(...accent);
  doc.roundedRect(pageWidth - 14 - paidWidth, 24, paidWidth, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(paidLabel, pageWidth - 14 - paidWidth / 2, 28.8, { align: "center" });

  headerBottom = Math.max(headerBottom, 34);
  doc.setFillColor(...accent);
  doc.rect(14, headerBottom + 4, pageWidth - 28, 0.8, "F");

  const contentTop = headerBottom + 16;
  setInvoiceFont(doc, "bold", 10);
  doc.setTextColor(15, 23, 42);
  doc.text("Bill To", 14, contentTop);

  const billTo = [
    invoice.client.name,
    invoice.client.company,
    invoice.client.email,
    invoice.client.phone,
    invoice.client.country,
  ].filter((value): value is string => !!value && value.trim().length > 0);

  setInvoiceFont(doc, "normal", 10);
  billTo.forEach((line, index) => {
    if (index === 0) {
      setInvoiceFont(doc, "bold", 11);
      doc.setTextColor(15, 23, 42);
    } else {
      setInvoiceFont(doc, "normal", 9);
      doc.setTextColor(71, 85, 105);
    }
    doc.text(line, 14, contentTop + 7 + index * 5.5);
  });

  const metaX = 118;
  const meta = [
    ["Invoice Number", invoice.invoiceNumber],
    ["Payment Date", formatDate(invoice.paidAt)],
    ["Payment Method", PROVIDER_LABEL[invoice.provider] || invoice.provider],
    ["Status", "Paid"],
  ];
  if (invoice.paymentReference) {
    meta.push(["Payment Reference", invoice.paymentReference]);
  }

  meta.forEach(([label, value], index) => {
    const y = contentTop + index * 9;
    setInvoiceFont(doc, "normal", 8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, metaX, y);
    setInvoiceFont(doc, "bold", 9);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(String(value), 78);
    doc.text(lines, metaX, y + 4);
  });

  const tableStart = Math.max(contentTop + billTo.length * 5.5 + 16, contentTop + meta.length * 9 + 8);

  autoTable(doc, {
    startY: tableStart,
    head: [["Description", "Amount"]],
    body: [[invoice.description || "Payment", formatCurrency(invoice.amount, invoice.currency)]],
    foot: [["Total paid", formatCurrency(invoice.amount, invoice.currency)]],
    theme: "plain",
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      font: doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica",
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    bodyStyles: {
      font: doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica",
      fontSize: 10,
      textColor: [15, 23, 42],
      cellPadding: { top: 7, bottom: 7, left: 5, right: 5 },
    },
    footStyles: {
      fillColor: accentSoft,
      textColor: [15, 23, 42],
      font: doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica",
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
    },
    columnStyles: {
      1: { halign: "right", cellWidth: 42 },
    },
  });

  const tableEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableStart + 30;

  doc.setFillColor(...accentSoft);
  doc.roundedRect(14, tableEnd + 12, pageWidth - 28, 16, 2, 2, "F");
  setInvoiceFont(doc, "bold", 11);
  doc.setTextColor(...accent);
  doc.text("This invoice has been paid in full.", pageWidth / 2, tableEnd + 22, {
    align: "center",
  });

  setInvoiceFont(doc, "normal", 9);
  doc.setTextColor(148, 163, 184);
  doc.text("Thank you for your payment.", pageWidth / 2, 285, { align: "center" });

  return doc.output("arraybuffer");
}

export async function invoicePdfResponse(invoice: InvoiceData) {
  const pdfBuffer = await buildInvoicePdf(invoice);
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
