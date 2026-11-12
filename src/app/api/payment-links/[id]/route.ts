import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { processSuccessfulPayment } from "@/lib/targets";
import { isDemoMode } from "@/lib/demo";
import { withBrandLogoUrl } from "@/lib/brands";
import { cancelOpenStripeIntents } from "@/lib/stripe-payment-link";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Public pay page: never expose seller identity to the client
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id },
    select: {
      id: true,
      amount: true,
      currency: true,
      description: true,
      provider: true,
      status: true,
      externalUrl: true,
      expiresAt: true,
      createdAt: true,
      client: { select: { name: true, email: true } },
      brand: {
        select: {
          id: true,
          name: true,
          logo: true,
          primaryColor: true,
          tagline: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...paymentLink,
    brand: paymentLink.brand ? withBrandLogoUrl(paymentLink.brand) : null,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo simulate only available in demo mode" }, { status: 403 });
  }

  const { id } = await params;

  const paymentLink = await prisma.paymentLink.findUnique({ where: { id } });
  if (!paymentLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  if (paymentLink.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  const transaction = await processSuccessfulPayment({
    paymentLinkId: id,
    amount: paymentLink.amount,
    currency: paymentLink.currency,
    provider: paymentLink.provider,
    externalId: `demo_pay_${id}_${Date.now()}`,
    metadata: { demo: true },
  });

  return NextResponse.json({ success: true, transaction });
}

function hasCompletedPayment(
  paymentLink: {
    status: string;
    transactions: { status: string }[];
  }
) {
  if (paymentLink.status === "PAID") return true;
  return paymentLink.transactions.some(
    (transaction) => transaction.status === "COMPLETED" || transaction.status === "REFUNDED"
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { transactions: { select: { status: true } } },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if (user.role !== "SUPER_ADMIN" && paymentLink.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (hasCompletedPayment(paymentLink)) {
      return NextResponse.json(
        { error: "Paid payment links cannot be deleted" },
        { status: 400 }
      );
    }

    await cancelOpenStripeIntents(id);

    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentLink.findUnique({
        where: { id },
        include: { transactions: { select: { status: true } } },
      });

      if (!current) {
        throw new Error("Payment link not found");
      }

      if (hasCompletedPayment(current)) {
        throw new Error("Paid payment links cannot be deleted");
      }

      await tx.transaction.deleteMany({
        where: { paymentLinkId: id, status: { in: ["PENDING", "FAILED"] } },
      });
      await tx.paymentLink.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Payment link deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete payment link";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Paid payment links cannot be deleted"
          ? 400
          : message === "Payment link not found"
            ? 404
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
