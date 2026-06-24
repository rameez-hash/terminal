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

export async function createStripeEmbeddedSession({
  amount,
  currency,
  description,
  paymentLinkId,
  clientEmail,
  returnUrl,
}: {
  amount: number;
  currency: string;
  description?: string;
  paymentLinkId: string;
  clientEmail: string;
  returnUrl: string;
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
            name: description || "Payment",
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
