import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStripePaymentLink } from "@/lib/stripe-payment-link";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      select: { id: true, status: true, provider: true },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if (paymentLink.status === "PAID") {
      return NextResponse.json({ paid: true });
    }

    if (paymentLink.provider === "STRIPE") {
      const synced = await syncStripePaymentLink(id);
      return NextResponse.json({ paid: synced.paid });
    }

    return NextResponse.json({ paid: false });
  } catch (error) {
    console.error("Payment confirm error:", error);
    return NextResponse.json({ paid: false }, { status: 500 });
  }
}
