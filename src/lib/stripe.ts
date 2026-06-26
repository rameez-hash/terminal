import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export function hasStripeConfig() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export async function createStripePaymentIntent({
  amount,
  currency,
  description,
  paymentLinkId,
  clientEmail,
  brandName,
}: {
  amount: number;
  currency: string;
  description?: string;
  paymentLinkId: string;
  clientEmail: string;
  brandName?: string;
}) {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    receipt_email: clientEmail,
    description: brandName
      ? `${brandName} — ${description || "Payment"}`
      : description || "Payment",
    metadata: { paymentLinkId },
    automatic_payment_methods: { enabled: true },
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Failed to create Stripe payment intent");
  }

  return paymentIntent;
}

export async function createStripeEmbeddedSession({
  amount,
  currency,
  description,
  paymentLinkId,
  clientEmail,
  returnUrl,
  brandName,
}: {
  amount: number;
  currency: string;
  description?: string;
  paymentLinkId: string;
  clientEmail: string;
  returnUrl: string;
  brandName?: string;
}) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "if_required",
    return_url: returnUrl,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: brandName ? `${brandName} — ${description || "Payment"}` : description || "Payment",
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: clientEmail,
    metadata: {
      paymentLinkId,
    },
  } as unknown as Stripe.Checkout.SessionCreateParams);

  return session;
}

export function verifyStripeWebhook(payload: string | Buffer, signature: string) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Stripe webhook secret not configured");
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
