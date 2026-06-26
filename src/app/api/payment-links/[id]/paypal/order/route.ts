import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPayPalOrder, hasPayPalConfig } from "@/lib/paypal";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (!hasPayPalConfig()) {
      return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
    }

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { client: true, brand: true },
    });

    if (!paymentLink || paymentLink.provider !== "PAYPAL") {
      return NextResponse.json({ error: "PayPal payment link not found" }, { status: 404 });
    }

    if (paymentLink.status !== "ACTIVE") {
      return NextResponse.json({ error: "Payment link is not active" }, { status: 400 });
    }

    const { order } = await createPayPalOrder({
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description || undefined,
      paymentLinkId: paymentLink.id,
      returnUrl: `${baseUrl}/pay/${id}`,
      cancelUrl: `${baseUrl}/pay/${id}?cancelled=true`,
      brandName: paymentLink.brand?.name,
    });

    if (!order.id) {
      return NextResponse.json({ error: "PayPal did not return an order ID" }, { status: 500 });
    }

    await prisma.paymentLink.update({
      where: { id },
      data: {
        paypalOrderId: order.id,
        externalId: order.id,
      },
    });

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    console.error("PayPal order error:", error);
    const message = error instanceof Error ? error.message : "Failed to create PayPal order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
