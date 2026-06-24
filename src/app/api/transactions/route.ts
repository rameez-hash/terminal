import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, sortBy, sortOrder } = parsePaginationParams(searchParams);
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const sellerId = searchParams.get("sellerId");

    const where = {
      ...(user.role === "SELLER" ? { sellerId: user.id } : sellerId ? { sellerId } : {}),
      ...(status && { status: status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" }),
      ...(provider && { provider: provider as "STRIPE" | "PAYPAL" }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true, email: true } },
          paymentLink: { select: { id: true, description: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(transactions, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
