import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { recordManualPayment } from "@/lib/payments";

const manualPaymentSchema = z.object({
  clientId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  description: z.string().optional(),
  sellerId: z.string().optional(),
  paymentLinkId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = manualPaymentSchema.parse(body);

    const sellerId =
      user.role === "SUPER_ADMIN" && data.sellerId ? data.sellerId : user.id;

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (user.role === "SELLER" && client.createdBy !== user.id) {
      return NextResponse.json({ error: "You can only record payments for your clients" }, { status: 403 });
    }

    const transaction = await recordManualPayment({
      sellerId,
      clientId: data.clientId,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      paymentLinkId: data.paymentLinkId,
      recordedByUserId: user.id,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
