import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getBrandedPaymentUrl } from "@/lib/demo";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

const createPaymentLinkSchema = z.object({
  clientId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  description: z.string().optional(),
  provider: z.enum(["STRIPE", "PAYPAL"]),
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, search, skip, sortBy, sortOrder } = parsePaginationParams(searchParams);
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");

    const where = {
      ...(user.role === "SELLER" ? { sellerId: user.id } : {}),
      ...(status && { status: status as "ACTIVE" | "EXPIRED" | "PAID" | "CANCELLED" }),
      ...(provider && { provider: provider as "STRIPE" | "PAYPAL" }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: "insensitive" as const } },
          { client: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [links, total] = await Promise.all([
      prisma.paymentLink.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.paymentLink.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(links, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = createPaymentLinkSchema.parse(body);

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const paymentLink = await prisma.paymentLink.create({
      data: {
        sellerId: user.id,
        clientId: data.clientId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        provider: data.provider,
      },
    });

    const brandedUrl = getBrandedPaymentUrl(paymentLink.id);
    const updated = await prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { externalUrl: brandedUrl },
      include: { client: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      userId: user.id,
      type: "PAYMENT_LINK_CREATED",
      description: `Created ${data.provider} payment link for ${client.name} - ${data.amount} ${data.currency}`,
      metadata: { paymentLinkId: updated.id, provider: data.provider, url: brandedUrl },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
