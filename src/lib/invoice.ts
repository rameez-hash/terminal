import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { convertIndexedToRgb, decode, encode } from "fast-png";
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

type PdfImage = { data: string; format: "PNG" | "JPEG" };

const PAID_GREEN: [number, number, number] = [22, 163, 74];
const PAID_GREEN_SOFT = mixWithWhite(PAID_GREEN, 0.88);

function invoiceNumberFor(transactionId: string) {
  return `INV-${transactionId.slice(-10).toUpperCase()}`;
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

function detectImageFormat(buffer: Buffer): "png" | "jpeg" | "webp" | "svg" | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  const head = buffer.subarray(0, 80).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return null;
}

function flattenPngForPdf(buffer: Buffer): Buffer {
  const png = decode(buffer);
  let channels = png.channels;
  let data: Uint8Array = Uint8Array.from(png.data);

  if (png.palette) {
    data = convertIndexedToRgb(png);
    channels = png.transparency ? 4 : 3;
  }

  const pixels = png.width * png.height;
  const rgba = new Uint8Array(pixels * 4);

  for (let i = 0; i < pixels; i++) {
    const di = i * 4;
    if (channels === 4) {
      const si = i * 4;
      const alpha = data[si + 3] / 255;
      rgba[di] = Math.round(data[si] * alpha + 255 * (1 - alpha));
      rgba[di + 1] = Math.round(data[si + 1] * alpha + 255 * (1 - alpha));
      rgba[di + 2] = Math.round(data[si + 2] * alpha + 255 * (1 - alpha));
      rgba[di + 3] = 255;
    } else if (channels === 3) {
      const si = i * 3;
      rgba[di] = data[si];
      rgba[di + 1] = data[si + 1];
      rgba[di + 2] = data[si + 2];
      rgba[di + 3] = 255;
    } else if (channels === 2) {
      const gray = data[i * 2];
      const alpha = data[i * 2 + 1] / 255;
      const value = Math.round(gray * alpha + 255 * (1 - alpha));
      rgba[di] = value;
      rgba[di + 1] = value;
      rgba[di + 2] = value;
      rgba[di + 3] = 255;
    } else {
      const gray = data[i];
      rgba[di] = gray;
      rgba[di + 1] = gray;
      rgba[di + 2] = gray;
      rgba[di + 3] = 255;
    }
  }

  return Buffer.from(encode({ width: png.width, height: png.height, data: rgba, channels: 4, depth: 8 }));
}

function storedLogoToBuffer(logo: string): Buffer | null {
  if (logo.startsWith("data:")) {
    const marker = "base64,";
    const index = logo.indexOf(marker);
    if (index >= 0) {
      return Buffer.from(logo.slice(index + marker.length), "base64");
    }

    const svgMarker = "data:image/svg+xml";
    if (logo.startsWith(svgMarker)) {
      const comma = logo.indexOf(",");
      if (comma >= 0) {
        return Buffer.from(decodeURIComponent(logo.slice(comma + 1)), "utf8");
      }
    }
    return null;
  }

  if (logo.startsWith("http://") || logo.startsWith("https://")) {
    return null;
  }

  const relative = logo.replace(/^\//, "").split("?")[0];
  const publicPath = path.join(process.cwd(), "public", relative);
  if (fs.existsSync(publicPath)) {
    return fs.readFileSync(publicPath);
  }

  return null;
}

function invoiceAssetPath(fileName: string) {
  return [
    path.join(process.cwd(), "src", "invoice-assets", fileName),
    path.join(process.cwd(), "public", "invoice-assets", fileName),
  ].find((candidate) => fs.existsSync(candidate));
}

function bundledChicagoLogo(): PdfImage | null {
  const file = invoiceAssetPath("chicago-publishers.png");
  if (!file) return null;
  return { format: "PNG", data: fs.readFileSync(file).toString("base64") };
}

function isChicagoBrand(brand?: InvoiceData["brand"] | null) {
  return (brand?.name || "").toLowerCase().includes("chicago");
}

async function brandLogoToPng(logo?: string | null): Promise<PdfImage | null> {
  if (!logo) return null;

  let buffer = storedLogoToBuffer(logo);

  if (!buffer && (logo.startsWith("http://") || logo.startsWith("https://"))) {
    try {
      const response = await fetch(logo);
      if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error("Invoice logo download failed:", error);
    }
  }

  if (!buffer?.length) return null;

  try {
    const format = detectImageFormat(buffer);
    if (format === "jpeg") {
      return { format: "JPEG", data: buffer.toString("base64") };
    }
    if (format === "png") {
      return { format: "PNG", data: flattenPngForPdf(buffer).toString("base64") };
    }
  } catch (error) {
    console.error("Invoice logo convert failed:", error);
  }

  return null;
}

async function resolveInvoiceLogo(brand?: InvoiceData["brand"] | null): Promise<PdfImage | null> {
  if (isChicagoBrand(brand)) {
    const bundled = bundledChicagoLogo();
    if (bundled) return bundled;
  }
  return brandLogoToPng(brand?.logo);
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

function drawPaidBackgroundStamp(doc: jsPDF) {
  try {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.14 }));
    setInvoiceFont(doc, "bold", 108);
    doc.setTextColor(...PAID_GREEN);
    doc.text("PAID", pageWidth / 2, pageHeight / 2 + 10, {
      align: "center",
      angle: 32,
    });
    doc.restoreGraphicsState();
  } catch (error) {
    console.error("Invoice PAID stamp failed:", error);
    try {
      doc.restoreGraphicsState();
    } catch {
      // Keep generating the invoice even if the watermark fails.
    }
  }
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
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, height, "F");
  doc.addImage(dataUrl, image.format, x, y, width, height);
  return { width, height };
}

export async function buildInvoicePdf(invoice: InvoiceData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerMontserrat(doc);

  const ink: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const inkSoft = mixWithWhite(ink, 0.93);
  const brandName = invoice.brand?.name || "Invoice";
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await resolveInvoiceLogo(invoice.brand);

  drawPaidBackgroundStamp(doc);

  let headerBottom = 18;
  if (logo) {
    try {
      const placed = drawBrandLogo(doc, logo, 14, 10, 110, 36);
      headerBottom = Math.max(headerBottom, 10 + placed.height);
    } catch (error) {
      console.error("Invoice logo embed failed:", error);
      setInvoiceFont(doc, "bold", 18);
      doc.setTextColor(...ink);
      doc.text(brandName, 14, 22);
      headerBottom = 22;
    }
  } else {
    setInvoiceFont(doc, "bold", 18);
    doc.setTextColor(...ink);
    doc.text(brandName, 14, 22);
    if (invoice.brand?.tagline) {
      setInvoiceFont(doc, "normal", 9);
      doc.setTextColor(...muted);
      doc.text(invoice.brand.tagline, 14, 28);
      headerBottom = 30;
    } else {
      headerBottom = 24;
    }
  }

  setInvoiceFont(doc, "bold", 22);
  doc.setTextColor(...ink);
  doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

  const paidLabel = "PAID";
  setInvoiceFont(doc, "bold", 8);
  const paidWidth = doc.getTextWidth(paidLabel) + 8;
  doc.setFillColor(...PAID_GREEN);
  doc.roundedRect(pageWidth - 14 - paidWidth, 24, paidWidth, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(paidLabel, pageWidth - 14 - paidWidth / 2, 28.8, { align: "center" });

  headerBottom = Math.max(headerBottom, 34);
  doc.setFillColor(...ink);
  doc.rect(14, headerBottom + 4, pageWidth - 28, 0.45, "F");

  const contentTop = headerBottom + 14;
  const valueX = 132;
  const valueWidth = pageWidth - 14 - valueX;

  setInvoiceFont(doc, "bold", 8);
  doc.setTextColor(...muted);
  doc.text("BILL TO", 14, contentTop);

  const billTo = [
    invoice.client.name,
    invoice.client.company,
    invoice.client.email,
    invoice.client.phone,
    invoice.client.country,
  ].filter((value): value is string => !!value && value.trim().length > 0);

  billTo.forEach((line, index) => {
    const y = contentTop + 8 + index * 5.8;
    if (index === 0) {
      setInvoiceFont(doc, "bold", 12);
      doc.setTextColor(...ink);
    } else {
      setInvoiceFont(doc, "normal", 9);
      doc.setTextColor(51, 65, 85);
    }
    doc.text(line, 14, y);
  });

  const meta = [
    ["Invoice Number", invoice.invoiceNumber],
    ["Payment Date", formatDate(invoice.paidAt)],
    ["Payment Method", PROVIDER_LABEL[invoice.provider] || invoice.provider],
    ["Status", "Paid"],
  ];
  if (invoice.paymentReference) {
    meta.push(["Payment Reference", invoice.paymentReference]);
  }

  let metaY = contentTop;
  meta.forEach(([label, value]) => {
    setInvoiceFont(doc, "normal", 8);
    doc.setTextColor(...muted);
    doc.text(label, valueX - 3, metaY, { align: "right" });
    setInvoiceFont(doc, "bold", 9);
    if (label === "Status") doc.setTextColor(...PAID_GREEN);
    else doc.setTextColor(...ink);
    const text = String(value);
    if (label === "Payment Reference") {
      let size = 8;
      setInvoiceFont(doc, "bold", size);
      while (doc.getTextWidth(text) > valueWidth && size > 6.5) {
        size -= 0.2;
        doc.setFontSize(size);
      }
      doc.text(text, valueX, metaY);
      metaY += 7.2;
    } else {
      const lines = doc.splitTextToSize(text, valueWidth);
      doc.text(lines, valueX, metaY);
      metaY += Math.max(7.2, lines.length * 4.2 + 3);
    }
  });

  const tableStart = Math.max(contentTop + 8 + billTo.length * 5.8, metaY) + 10;

  autoTable(doc, {
    startY: tableStart,
    head: [["Description", "Amount"]],
    body: [[invoice.description || "Payment", formatCurrency(invoice.amount, invoice.currency)]],
    foot: [["Total paid", formatCurrency(invoice.amount, invoice.currency)]],
    theme: "plain",
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: ink,
      textColor: [255, 255, 255],
      font: doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica",
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    bodyStyles: {
      font: doc.getFontList()[FONT_NAME] ? FONT_NAME : "helvetica",
      fontSize: 10,
      textColor: ink,
      cellPadding: { top: 7, bottom: 7, left: 5, right: 5 },
    },
    footStyles: {
      fillColor: inkSoft,
      textColor: ink,
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

  doc.setFillColor(...PAID_GREEN_SOFT);
  doc.roundedRect(14, tableEnd + 12, pageWidth - 28, 22, 2, 2, "F");
  setInvoiceFont(doc, "bold", 12);
  doc.setTextColor(...PAID_GREEN);
  doc.text("PAID", pageWidth / 2, tableEnd + 21, { align: "center" });
  setInvoiceFont(doc, "normal", 9);
  doc.text("Payment received. This invoice is complete.", pageWidth / 2, tableEnd + 28, {
    align: "center",
  });

  const note =
    "Note: For your reference, payment made for this invoice will appear on your bank or credit card statement as BMD Digital INC., our parent company & authorized billing entity.";
  setInvoiceFont(doc, "normal", 8);
  doc.setTextColor(...muted);
  const noteLines = doc.splitTextToSize(note, pageWidth - 28);
  doc.text(noteLines, 14, tableEnd + 42);

  return doc.output("arraybuffer");
}

export async function invoicePdfResponse(invoice: InvoiceData) {
  const pdfBuffer = await buildInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
