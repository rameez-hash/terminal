import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

const createSellerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { page, limit, search, skip, sortBy, sortOrder } = parsePaginationParams(searchParams);
    const status = searchParams.get("status");
    const trash = searchParams.get("trash") === "1";

    const where = {
      role: "SELLER" as const,
      deletedAt: trash ? { not: null } : null,
      ...(status && { status: status as "ACTIVE" | "SUSPENDED" }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [sellers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          deletedAt: true,
          createdAt: true,
          _count: { select: { clientsCreated: true, paymentLinks: true, transactions: true } },
        },
        orderBy: trash ? { deletedAt: "desc" } : { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(sellers, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createSellerSchema.parse(body);

    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.deletedAt) {
        return NextResponse.json(
          { error: "Email is in seller trash. Restore that seller or permanently delete them first." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const seller = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: hashedPassword,
        phone: data.phone?.trim() || null,
        role: "SELLER",
      },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
    });

    await logActivity({
      userId: admin.id,
      type: "SELLER_CREATED",
      description: `Created seller account for ${seller.name}`,
      metadata: { sellerId: seller.id },
    });

    await notifyAdmins({
      type: "NEW_SELLER_CREATED",
      title: "New Seller Created",
      message: `Seller ${seller.name} (${seller.email}) has been created.`,
      metadata: { sellerId: seller.id },
    });

    return NextResponse.json(seller, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}
