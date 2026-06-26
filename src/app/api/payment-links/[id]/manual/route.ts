import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { recordManualPayment } from "@/lib/payments";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!paymentLink) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if (user.role === "SELLER" && paymentLink.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (paymentLink.status === "PAID") {
      return NextResponse.json({ error: "Payment link is already paid" }, { status: 400 });
    }

    if (paymentLink.status !== "ACTIVE") {
      return NextResponse.json({ error: "Payment link is not active" }, { status: 400 });
    }

    const transaction = await recordManualPayment({
      sellerId: paymentLink.sellerId,
      clientId: paymentLink.clientId,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description || `Manual payment for link ${id}`,
      paymentLinkId: paymentLink.id,
      recordedByUserId: user.id,
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
