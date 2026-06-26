import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStripePaymentIntent, hasStripeConfig } from "@/lib/stripe";
import { hasPayPalConfig, getPayPalClientId } from "@/lib/paypal";
import { isDemoMode } from "@/lib/demo";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { client: true, brand: true },
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
        return NextResponse.json(
          { error: "Stripe is not configured. Missing API keys." },
          { status: 503 }
        );
      }

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        return NextResponse.json(
          { error: "Stripe publishable key is missing on server." },
          { status: 503 }
        );
      }

      const paymentIntent = await createStripePaymentIntent({
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        description: paymentLink.description || undefined,
        paymentLinkId: paymentLink.id,
        clientEmail: paymentLink.client.email,
        brandName: paymentLink.brand?.name,
      });

      await prisma.paymentLink.update({
        where: { id },
        data: {
          stripeSessionId: paymentIntent.id,
          externalId: paymentIntent.id,
        },
      });

      return NextResponse.json({
        mode: "stripe_payment",
        clientSecret: paymentIntent.client_secret,
        publishableKey,
        returnUrl: `${baseUrl}/pay/${id}`,
      });
    }

    if (paymentLink.provider === "PAYPAL") {
      if (!hasPayPalConfig()) {
        return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
      }

      const clientId = getPayPalClientId();
      if (!clientId) {
        return NextResponse.json(
          { error: "PayPal client ID is missing. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        mode: "paypal_embedded",
        clientId,
        currency: paymentLink.currency,
      });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    console.error("Checkout init error:", error);
    const message = error instanceof Error ? error.message : "Failed to initialize checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
