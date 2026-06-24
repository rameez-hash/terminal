import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPayPalOrder, capturePayPalOrder, hasPayPalConfig } from "@/lib/paypal";
import { processSuccessfulPayment } from "@/lib/targets";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!hasPayPalConfig()) {
    return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
  }

  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id },
    include: { client: true },
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
    returnUrl: `${baseUrl}/pay/${id}?success=true`,
    cancelUrl: `${baseUrl}/pay/${id}?cancelled=true`,
  });

  await prisma.paymentLink.update({
    where: { id },
    data: {
      paypalOrderId: order.id,
      externalId: order.id,
    },
  });

  return NextResponse.json({ orderId: order.id });
}
