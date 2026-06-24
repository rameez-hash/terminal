import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { processSuccessfulPayment } from "@/lib/targets";

export async function POST(request: Request) {
  const body = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const isValid = await verifyPayPalWebhook(headers, body);
  if (!isValid && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const event = JSON.parse(body);

    await prisma.webhookLog.create({
      data: {
        provider: "paypal",
        event: event.event_type,
        payload: event,
      },
    });

    if (event.event_type === "CHECKOUT.ORDER.APPROVED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource;
      const paymentLinkId = resource.purchase_units?.[0]?.custom_id || resource.custom_id;

      if (paymentLinkId) {
        const amount = parseFloat(
          resource.purchase_units?.[0]?.amount?.value || resource.amount?.value || "0"
        );
        const currency =
          resource.purchase_units?.[0]?.amount?.currency_code ||
          resource.amount?.currency_code ||
          "USD";

        await processSuccessfulPayment({
          paymentLinkId,
          amount,
          currency,
          provider: "PAYPAL",
          externalId: resource.id,
          metadata: { orderId: resource.id },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
