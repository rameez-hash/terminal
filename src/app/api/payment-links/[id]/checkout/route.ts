import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStripeEmbeddedSession, hasStripeConfig } from "@/lib/stripe";
import { hasPayPalConfig } from "@/lib/paypal";
import { isDemoMode } from "@/lib/demo";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  if (paymentLink.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  if (paymentLink.status !== "ACTIVE") {
    return NextResponse.json({ error: "Payment link is not active" }, { status: 400 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ mode: "demo" });
  }

  if (paymentLink.provider === "STRIPE") {
    if (!hasStripeConfig()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const session = await createStripeEmbeddedSession({
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description || undefined,
      paymentLinkId: paymentLink.id,
      clientEmail: paymentLink.client.email,
      returnUrl: `${baseUrl}/pay/${id}?success=true`,
    });

    await prisma.paymentLink.update({
      where: { id },
      data: {
        stripeSessionId: session.id,
        externalId: session.id,
      },
    });

    return NextResponse.json({
      mode: "stripe_embedded",
      clientSecret: session.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });
  }

  if (paymentLink.provider === "PAYPAL") {
    if (!hasPayPalConfig()) {
      return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
    }

    return NextResponse.json({
      mode: "paypal_embedded",
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID,
      currency: paymentLink.currency,
    });
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
