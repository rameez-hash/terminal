import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  duplicateClientMessage,
  findClientDuplicate,
  normalizeEmail,
  normalizePhone,
} from "@/lib/clients";

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

    if (!client || client.deletedAt) {
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
    if (!client || client.deletedAt) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const canEdit = user.role === "SUPER_ADMIN" || client.createdBy === user.id;
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextEmail = data.email ? normalizeEmail(data.email) : client.email;
    const nextPhone =
      data.phone !== undefined
        ? data.phone.trim()
          ? normalizePhone(data.phone)
          : null
        : client.phone;

    const duplicate = await findClientDuplicate(nextEmail, nextPhone, id);
    if (duplicate) {
      return NextResponse.json(
        { error: duplicateClientMessage(duplicate.field) },
        { status: 409 }
      );
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        ...(data.email && { email: nextEmail }),
        ...(data.phone !== undefined && { phone: nextPhone }),
      },
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "1";

    const client = await prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { paymentLinks: true, transactions: true } } },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (permanent) {
      if (!client.deletedAt) {
        return NextResponse.json(
          { error: "Move the client to trash before permanently deleting" },
          { status: 400 }
        );
      }

      if (client._count.paymentLinks > 0 || client._count.transactions > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot permanently delete a client with payment links or transactions. Keep them in trash.",
          },
          { status: 409 }
        );
      }

      await prisma.client.delete({ where: { id } });

      await logActivity({
        userId: admin.id,
        type: "CLIENT_DELETED",
        description: `Permanently deleted client ${client.name}`,
        metadata: { clientId: id, permanent: true },
      });

      return NextResponse.json({ message: "Client permanently deleted" });
    }

    if (client.deletedAt) {
      return NextResponse.json({ error: "Client is already in trash" }, { status: 400 });
    }

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: admin.id,
      type: "CLIENT_DELETED",
      description: `Moved client ${client.name} to trash`,
      metadata: { clientId: id },
    });

    return NextResponse.json({ message: "Client moved to trash" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 }
    );
  }
}
