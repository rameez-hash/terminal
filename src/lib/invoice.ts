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

function descriptionFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).description;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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
          brand: {
            select: {
              name: true,
              logo: true,
              primaryColor: true,
              tagline: true,
            },
          },
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
          brand: {
            select: {
              name: true,
              logo: true,
              primaryColor: true,
              tagline: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) return { paymentLink, notPaid: true as const };
  return { paymentLink, invoice: invoiceFromTransaction(transaction), transaction };
}

function tryBrandLogo(logo?: string | null): { format: "PNG" | "JPEG"; data: string } | null {
  if (!logo?.startsWith("data:image/")) return null;
  const match = logo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;
  const format = match[1].toLowerCase() === "png" ? "PNG" : "JPEG";
  return { format, data: match[2] };
}

export function buildInvoicePdf(invoice: InvoiceData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const accent = hexToRgb(invoice.brand?.primaryColor);
  const brandName = invoice.brand?.name || "Invoice";
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...accent);
  doc.rect(0, 0, pageWidth, 28, "F");

  const logo = tryBrandLogo(invoice.brand?.logo);
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, 14, 6, 16, 16);
    } catch {
      // Skip logo if the stored image cannot be embedded.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(brandName, logo ? 34 : 14, 13);
  if (invoice.brand?.tagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(invoice.brand.tagline, logo ? 34 : 14, 20);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", pageWidth - 14, 13, { align: "right" });
  doc.setFontSize(10);
  doc.text("PAID", pageWidth - 14, 20, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bill To", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const billTo = [
    invoice.client.name,
    invoice.client.company,
    invoice.client.email,
    invoice.client.phone,
    invoice.client.country,
  ].filter((value): value is string => !!value && value.trim().length > 0);

  billTo.forEach((line, index) => {
    doc.text(line, 14, 48 + index * 6);
  });

  const metaX = 120;
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
    const y = 42 + index * 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(label, metaX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(String(value), metaX, y + 4);
  });

  autoTable(doc, {
    startY: 88,
    head: [["Description", "Amount"]],
    body: [
      [
        invoice.description || "Payment",
        formatCurrency(invoice.amount, invoice.currency),
      ],
    ],
    foot: [["Total paid", formatCurrency(invoice.amount, invoice.currency)]],
    theme: "plain",
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [247, 250, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      1: { halign: "right" },
    },
  });

  const tableEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110;

  doc.setFillColor(232, 248, 245);
  doc.roundedRect(14, tableEnd + 10, pageWidth - 28, 16, 2, 2, "F");
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("This invoice has been paid in full.", pageWidth / 2, tableEnd + 20, {
    align: "center",
  });

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Thank you for your payment.", pageWidth / 2, 280, { align: "center" });

  return doc.output("arraybuffer");
}

export function invoicePdfResponse(invoice: InvoiceData) {
  const pdfBuffer = buildInvoicePdf(invoice);
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
