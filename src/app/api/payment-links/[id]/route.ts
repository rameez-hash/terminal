import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSuccessfulPayment } from "@/lib/targets";
import { isDemoMode } from "@/lib/demo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true } },
      seller: { select: { name: true } },
    },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  return NextResponse.json(paymentLink);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo simulate only available in demo mode" }, { status: 403 });
  }

  const { id } = await params;

  const paymentLink = await prisma.paymentLink.findUnique({ where: { id } });
  if (!paymentLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  if (paymentLink.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  const transaction = await processSuccessfulPayment({
    paymentLinkId: id,
    amount: paymentLink.amount,
    currency: paymentLink.currency,
    provider: paymentLink.provider,
    externalId: `demo_pay_${id}_${Date.now()}`,
    metadata: { demo: true },
  });

  return NextResponse.json({ success: true, transaction });
}
