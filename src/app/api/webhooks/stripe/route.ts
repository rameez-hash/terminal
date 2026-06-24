import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeWebhook } from "@/lib/stripe";
import { processSuccessfulPayment } from "@/lib/targets";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const event = verifyStripeWebhook(body, signature);

    await prisma.webhookLog.create({
      data: {
        provider: "stripe",
        event: event.type,
        payload: JSON.parse(body),
      },
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentLinkId = session.metadata?.paymentLinkId;

      if (paymentLinkId && session.payment_status === "paid") {
        const amount = (session.amount_total || 0) / 100;
        const currency = (session.currency || "usd").toUpperCase();

        await processSuccessfulPayment({
          paymentLinkId,
          amount,
          currency,
          provider: "STRIPE",
          externalId: session.id,
          metadata: { sessionId: session.id },
        });
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const paymentLinkId = paymentIntent.metadata?.paymentLinkId;

      if (paymentLinkId) {
        const amount = (paymentIntent.amount || 0) / 100;
        const currency = (paymentIntent.currency || "usd").toUpperCase();

        await processSuccessfulPayment({
          paymentLinkId,
          amount,
          currency,
          provider: "STRIPE",
          externalId: paymentIntent.id,
          metadata: { paymentIntentId: paymentIntent.id },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
