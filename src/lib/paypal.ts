import {
  Client,
  Environment,
  OrdersController,
  CheckoutPaymentIntent,
  OrderApplicationContextUserAction,
  OrderApplicationContextShippingPreference,
  OrderApplicationContextLandingPage,
} from "@paypal/paypal-server-sdk";

let ordersController: OrdersController | null = null;

function getPayPalEnvironment() {
  const mode = process.env.PAYPAL_MODE?.toLowerCase();
  if (mode === "live" || mode === "production") return Environment.Production;
  if (mode === "sandbox") return Environment.Sandbox;
  return process.env.NODE_ENV === "production"
    ? Environment.Production
    : Environment.Sandbox;
}

function getOrdersController() {
  if (!ordersController) {
    const clientId = process.env.PAYPAL_CLIENT_ID || "";
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials are not configured");
    }

    const paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment: getPayPalEnvironment(),
    });

    ordersController = new OrdersController(paypalClient);
  }
  return ordersController;
}

export function hasPayPalConfig() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function getPayPalClientId() {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";
}

export async function createPayPalOrder({
  amount,
  currency,
  description,
  paymentLinkId,
  returnUrl,
  cancelUrl,
  brandName,
}: {
  amount: number;
  currency: string;
  description?: string;
  paymentLinkId: string;
  returnUrl: string;
  cancelUrl: string;
  brandName?: string;
}) {
  const controller = getOrdersController();
  const response = await controller.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: {
            currencyCode: currency.toUpperCase(),
            value: amount.toFixed(2),
          },
          description: description || "Payment",
          customId: paymentLinkId,
        },
      ],
      applicationContext: {
        returnUrl,
        cancelUrl,
        brandName: brandName || "Sales Portal",
        userAction: OrderApplicationContextUserAction.PayNow,
        shippingPreference: OrderApplicationContextShippingPreference.NoShipping,
        landingPage: OrderApplicationContextLandingPage.Billing,
      },
    },
  });

  const order = response.result;
  const approvalUrl = order.links?.find((link) => link.rel === "approve")?.href;

  return { order, approvalUrl };
}

export async function capturePayPalOrder(orderId: string) {
  const controller = getOrdersController();
  const response = await controller.captureOrder({
    id: orderId,
    body: {},
  });
  return response.result;
}

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";

  if (!webhookId || !clientId || !clientSecret) return false;

  const apiBase =
    getPayPalEnvironment() === Environment.Production
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  try {
    const response = await fetch(
      `${apiBase}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: JSON.stringify({
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      }
    );
    const data = await response.json();
    return data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
