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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER" },
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

    const seller = await prisma.user.findFirst({ where: { id, role: "SELLER" } });
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const seller = await prisma.user.findFirst({ where: { id, role: "SELLER" } });
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    await logActivity({
      userId: admin.id,
      type: "SELLER_DELETED",
      description: `Deleted seller ${seller.name}`,
      metadata: { sellerId: id },
    });

    return NextResponse.json({ message: "Seller deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
}
