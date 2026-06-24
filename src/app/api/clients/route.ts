import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, search, skip, sortBy, sortOrder } = parsePaginationParams(searchParams);
    const sellerId = searchParams.get("sellerId");

    const where = {
      ...(sellerId && { createdBy: sellerId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { company: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { paymentLinks: true, transactions: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(clients, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = createClientSchema.parse(body);

    const client = await prisma.client.create({
      data: { ...data, createdBy: user.id },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      userId: user.id,
      type: "CLIENT_CREATED",
      description: `Created client ${client.name}`,
      metadata: { clientId: client.id },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
