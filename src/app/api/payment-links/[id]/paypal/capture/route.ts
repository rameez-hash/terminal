import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { capturePayPalOrder, hasPayPalConfig } from "@/lib/paypal";
import { processSuccessfulPayment } from "@/lib/targets";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!hasPayPalConfig()) {
      return NextResponse.json({ error: "PayPal is not configured" }, { status: 503 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } });
    if (!paymentLink || paymentLink.provider !== "PAYPAL") {
      return NextResponse.json({ error: "PayPal payment link not found" }, { status: 404 });
    }

    if (paymentLink.status === "PAID") {
      return NextResponse.json({ success: true, message: "Already paid" });
    }

    const capture = await capturePayPalOrder(orderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payment was not completed. Please try again." },
        { status: 400 }
      );
    }

    const captureId =
      capture.purchaseUnits?.[0]?.payments?.captures?.[0]?.id || capture.id || orderId;
    const amount = parseFloat(
      capture.purchaseUnits?.[0]?.payments?.captures?.[0]?.amount?.value ||
        String(paymentLink.amount)
    );
    const currency =
      capture.purchaseUnits?.[0]?.payments?.captures?.[0]?.amount?.currencyCode ||
      paymentLink.currency;

    await processSuccessfulPayment({
      paymentLinkId: id,
      amount,
      currency,
      provider: "PAYPAL",
      externalId: captureId,
      metadata: { orderId, captureId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PayPal capture error:", error);
    const message = error instanceof Error ? error.message : "Payment capture failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
