import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getStripe, hasStripeConfig } from "@/lib/stripe";
import { capturePayPalOrder, getPayPalOrder, hasPayPalConfig } from "@/lib/paypal";
import { processSuccessfulPayment } from "@/lib/targets";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if (user.role !== "SUPER_ADMIN" && paymentLink.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (paymentLink.status === "PAID") {
      return NextResponse.json({
        paid: true,
        alreadyPaid: true,
        message: "Payment already recorded",
      });
    }

    if (paymentLink.provider === "STRIPE") {
      if (!hasStripeConfig()) {
        return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
      }

      const stripe = getStripe();
      const candidateIds = [paymentLink.externalId, paymentLink.stripeSessionId].filter(
        (v): v is string => !!v
      );

      for (const intentId of candidateIds) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
          if (paymentIntent.status === "succeeded") {
            const amount = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
            const currency = (paymentIntent.currency || paymentLink.currency).toUpperCase();
            const transaction = await processSuccessfulPayment({
              paymentLinkId: id,
              amount: amount || paymentLink.amount,
              currency,
              provider: "STRIPE",
              externalId: paymentIntent.id,
              metadata: { synced: true, paymentIntentId: paymentIntent.id },
            });
            return NextResponse.json({
              paid: true,
              message: "Payment synced from Stripe",
              transaction,
            });
          }
        } catch {
          // try next id / search
        }
      }

      try {
        const search = await stripe.paymentIntents.search({
          query: `metadata["paymentLinkId"]:"${id}" AND status:"succeeded"`,
          limit: 5,
        });
        const matched = search.data[0];
        if (matched) {
          const amount = (matched.amount_received || matched.amount || 0) / 100;
          const currency = (matched.currency || paymentLink.currency).toUpperCase();
          const transaction = await processSuccessfulPayment({
            paymentLinkId: id,
            amount: amount || paymentLink.amount,
            currency,
            provider: "STRIPE",
            externalId: matched.id,
            metadata: { synced: true, paymentIntentId: matched.id, via: "search" },
          });
          return NextResponse.json({
            paid: true,
            message: "Payment synced from Stripe",
            transaction,
          });
        }
      } catch {
        // Search may be unavailable on some Stripe accounts
      }

      return NextResponse.json({
        paid: false,
        message: "No successful Stripe payment found yet",
      });
    }

    if (paymentLink.provider === "PAYPAL") {
      if (!hasPayPalConfig()) {
        return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
      }

      const orderId = paymentLink.paypalOrderId || paymentLink.externalId;
      if (!orderId) {
        return NextResponse.json({
          paid: false,
          message: "No PayPal order found to sync yet",
        });
      }

      let order = await getPayPalOrder(orderId);
      let capture = order.purchaseUnits?.[0]?.payments?.captures?.[0] || null;

      if (!capture && order.status === "APPROVED") {
        order = await capturePayPalOrder(orderId);
        capture = order.purchaseUnits?.[0]?.payments?.captures?.[0] || null;
      }

      const captureStatus = capture?.status || order.status;
      if (captureStatus !== "COMPLETED" && order.status !== "COMPLETED") {
        return NextResponse.json({
          paid: false,
          message: `PayPal order status: ${order.status || "unknown"}`,
        });
      }

      const captureId = capture?.id || order.id || orderId;
      const amount = parseFloat(
        capture?.amount?.value || String(paymentLink.amount)
      );
      const currency =
        capture?.amount?.currencyCode || paymentLink.currency;

      const transaction = await processSuccessfulPayment({
        paymentLinkId: id,
        amount,
        currency,
        provider: "PAYPAL",
        externalId: captureId,
        metadata: { synced: true, orderId, captureId },
      });

      return NextResponse.json({
        paid: true,
        message: "Payment synced from PayPal",
        transaction,
      });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    console.error("Payment sync error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync payment";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 }
    );
  }
}
