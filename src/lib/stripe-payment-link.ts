import { prisma } from "@/lib/prisma";
import { createStripePaymentIntent, getStripe, hasStripeConfig } from "@/lib/stripe";
import { processSuccessfulPayment } from "@/lib/targets";

const REUSABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

type PaymentLinkRecord = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  provider: string;
  status: string;
  externalId: string | null;
  stripeSessionId: string | null;
  client: { email: string };
  brand?: { name: string } | null;
};

export async function cancelOpenStripeIntents(paymentLinkId: string, keepId?: string) {
  if (!hasStripeConfig()) return;

  const stripe = getStripe();
  try {
    const search = await stripe.paymentIntents.search({
      query: `metadata["paymentLinkId"]:"${paymentLinkId}"`,
      limit: 10,
    });

    for (const paymentIntent of search.data) {
      if (paymentIntent.id === keepId) continue;
      if (paymentIntent.status === "succeeded" || paymentIntent.status === "canceled") continue;
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch {
        // Intent may already be closed.
      }
    }
  } catch {
    // Search can be unavailable on some Stripe accounts.
  }
}

export async function syncStripePaymentLink(paymentLinkId: string) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id: paymentLinkId },
  });

  if (!paymentLink) return { paid: false as const, reason: "not_found" as const };
  if (paymentLink.status === "PAID") return { paid: true as const, alreadyPaid: true as const };
  if (paymentLink.provider !== "STRIPE" || !hasStripeConfig()) {
    return { paid: false as const, reason: "not_stripe" as const };
  }

  const stripe = getStripe();
  const candidateIds = [paymentLink.externalId, paymentLink.stripeSessionId].filter(
    (value): value is string => !!value && value.startsWith("pi_")
  );

  const record = async (paymentIntentId: string, amount: number, currency: string) => {
    const transaction = await processSuccessfulPayment({
      paymentLinkId,
      amount: amount || paymentLink.amount,
      currency,
      provider: "STRIPE",
      externalId: paymentIntentId,
      metadata: { paymentIntentId, synced: true },
    });
    await cancelOpenStripeIntents(paymentLinkId, paymentIntentId);
    return { paid: true as const, transaction };
  };

  const seen = new Set<string>();
  for (const intentId of candidateIds) {
    if (seen.has(intentId)) continue;
    seen.add(intentId);
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
      if (paymentIntent.status === "succeeded") {
        const amount = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
        const currency = (paymentIntent.currency || paymentLink.currency).toUpperCase();
        return record(paymentIntent.id, amount, currency);
      }
    } catch {
      // Try the next id.
    }
  }

  try {
    const search = await stripe.paymentIntents.search({
      query: `metadata["paymentLinkId"]:"${paymentLinkId}" AND status:"succeeded"`,
      limit: 1,
    });
    const matched = search.data[0];
    if (matched) {
      const amount = (matched.amount_received || matched.amount || 0) / 100;
      const currency = (matched.currency || paymentLink.currency).toUpperCase();
      return record(matched.id, amount, currency);
    }
  } catch {
    // Search can be unavailable on some Stripe accounts.
  }

  return { paid: false as const };
}

export async function prepareStripeCheckout(paymentLink: PaymentLinkRecord) {
  const synced = await syncStripePaymentLink(paymentLink.id);
  if (synced.paid) return { alreadyPaid: true as const };

  const stripe = getStripe();
  const expectedAmount = Math.round(paymentLink.amount * 100);
  const existingId = [paymentLink.stripeSessionId, paymentLink.externalId].find(
    (value) => !!value && value.startsWith("pi_")
  );

  if (existingId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(existingId);
      const sameAmount = existing.amount === expectedAmount;
      if (
        sameAmount &&
        existing.client_secret &&
        REUSABLE_STATUSES.has(existing.status)
      ) {
        if (existing.status === "processing") {
          return { processing: true as const };
        }
        return {
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
        };
      }

      if (existing.status !== "succeeded" && existing.status !== "processing") {
        try {
          await stripe.paymentIntents.cancel(existing.id);
        } catch {
          // Keep going and create a fresh intent.
        }
      }
    } catch {
      // Stored id is stale. Create a new intent below.
    }
  }

  const paymentIntent = await createStripePaymentIntent({
    amount: paymentLink.amount,
    currency: paymentLink.currency,
    description: paymentLink.description || undefined,
    paymentLinkId: paymentLink.id,
    clientEmail: paymentLink.client.email,
    brandName: paymentLink.brand?.name,
    idempotencyKey: existingId ? `plink_${paymentLink.id}_${Date.now()}` : `plink_${paymentLink.id}`,
  });

  await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: {
      stripeSessionId: paymentIntent.id,
      externalId: paymentIntent.id,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret as string,
    paymentIntentId: paymentIntent.id,
  };
}
