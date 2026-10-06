import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const updateSellerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  password: z.string().min(8).optional(),
});

async function hardDeleteSeller(id: string) {
  await prisma.$transaction(async (tx) => {
    const clients = await tx.client.findMany({
      where: { createdBy: id },
      select: { id: true },
    });
    const clientIds = clients.map((c) => c.id);

    await tx.transaction.deleteMany({
      where: {
        OR: [
          { sellerId: id },
          ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
        ],
      },
    });

    await tx.paymentLink.deleteMany({
      where: {
        OR: [
          { sellerId: id },
          ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
        ],
      },
    });

    await tx.client.deleteMany({ where: { createdBy: id } });
    await tx.activityLog.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER", deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        monthlyTargets: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 },
        _count: { select: { clientsCreated: true, paymentLinks: true, transactions: true } },
      },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    return NextResponse.json(seller);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateSellerSchema.parse(body);

    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER", deletedAt: null },
    });
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.status) updateData.status = data.status;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, status: true },
    });

    const activityType = data.status === "SUSPENDED" ? "SELLER_SUSPENDED" : "SELLER_UPDATED";
    await logActivity({
      userId: admin.id,
      type: activityType,
      description: `Updated seller ${updated.name}`,
      metadata: { sellerId: id, changes: data },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
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

    const seller = await prisma.user.findFirst({ where: { id, role: "SELLER" } });
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (permanent) {
      if (!seller.deletedAt) {
        return NextResponse.json(
          { error: "Move the seller to trash before permanently deleting" },
          { status: 400 }
        );
      }

      await hardDeleteSeller(id);

      await logActivity({
        userId: admin.id,
        type: "SELLER_DELETED",
        description: `Permanently deleted seller ${seller.name}`,
        metadata: { sellerId: id, permanent: true },
      });

      return NextResponse.json({ message: "Seller permanently deleted" });
    }

    if (seller.deletedAt) {
      return NextResponse.json({ error: "Seller is already in trash" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId: id } }),
    ]);

    await logActivity({
      userId: admin.id,
      type: "SELLER_DELETED",
      description: `Moved seller ${seller.name} to trash`,
      metadata: { sellerId: id },
    });

    return NextResponse.json({ message: "Seller moved to trash" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
