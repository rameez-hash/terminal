import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const updateClientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        paymentLinks: { orderBy: { createdAt: "desc" }, take: 10 },
        transactions: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = updateClientSchema.parse(body);

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const canEdit = user.role === "SUPER_ADMIN" || client.createdBy === user.id;
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.client.update({
      where: { id },
      data,
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      userId: user.id,
      type: "CLIENT_UPDATED",
      description: `Updated client ${updated.name}`,
      metadata: { clientId: id, changes: data },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}
