import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

const createSellerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const updateSellerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  password: z.string().min(8).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { page, limit, search, skip, sortBy, sortOrder } = parsePaginationParams(searchParams);
    const status = searchParams.get("status");

    const where = {
      role: "SELLER" as const,
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
          createdAt: true,
          _count: { select: { clientsCreated: true, paymentLinks: true, transactions: true } },
        },
        orderBy: { [sortBy]: sortOrder },
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

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const seller = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
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
