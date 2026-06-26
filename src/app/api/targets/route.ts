import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { parsePaginationParams, paginatedResponse, getCurrentMonthYear } from "@/lib/utils";
import {
  enrichSellerTargets,
  getSellerMonthlyRevenue,
  resolveAchievedAmount,
  enrichTargetMetrics,
} from "@/lib/payments";

const createTargetSchema = z.object({
  sellerId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  targetAmount: z.number().positive(),
  currency: z.string().default("USD"),
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(searchParams);
    const sellerId = searchParams.get("sellerId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const summary = searchParams.get("summary") === "true";

    if (user.role === "SUPER_ADMIN" && summary) {
      const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
      const selectedMonth = month ? parseInt(month, 10) : currentMonth;
      const selectedYear = year ? parseInt(year, 10) : currentYear;
      const sellerFilter = sellerId || undefined;

      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

      const [sellers, targets, transactions] = await Promise.all([
        prisma.user.findMany({
          where: {
            role: "SELLER",
            ...(sellerFilter ? { id: sellerFilter } : {}),
          },
          select: { id: true, name: true, email: true, status: true },
          orderBy: { name: "asc" },
        }),
        prisma.monthlyTarget.findMany({
          where: {
            month: selectedMonth,
            year: selectedYear,
            ...(sellerFilter ? { sellerId: sellerFilter } : {}),
          },
        }),
        prisma.transaction.groupBy({
          by: ["sellerId"],
          where: {
            status: "COMPLETED",
            createdAt: { gte: monthStart, lte: monthEnd },
            ...(sellerFilter ? { sellerId: sellerFilter } : {}),
          },
          _sum: { amount: true },
        }),
      ]);

      const targetBySeller = new Map(targets.map((t) => [t.sellerId, t]));
      const revenueBySeller = new Map(
        transactions.map((t) => [t.sellerId, t._sum.amount || 0])
      );

      const rows = sellers.map((seller) => {
        const target = targetBySeller.get(seller.id);
        const transactionTotal = revenueBySeller.get(seller.id) ?? 0;
        const achievedAmount = target
          ? resolveAchievedAmount(target.achievedAmount, transactionTotal)
          : transactionTotal;
        const targetAmount = target?.targetAmount ?? 0;
        const currency = target?.currency ?? "USD";

        return {
          id: target?.id ?? `summary-${seller.id}-${selectedMonth}-${selectedYear}`,
          sellerId: seller.id,
          seller,
          month: selectedMonth,
          year: selectedYear,
          targetAmount,
          achievedAmount,
          currency,
          hasTarget: !!target,
          completionPercentage:
            targetAmount > 0 ? Math.min(100, Math.round((achievedAmount / targetAmount) * 100)) : 0,
          remainingAmount: Math.max(0, targetAmount - achievedAmount),
          status:
            targetAmount <= 0
              ? "NO_TARGET"
              : achievedAmount >= targetAmount
                ? "COMPLETED"
                : "IN_PROGRESS",
        };
      });

      return NextResponse.json({
        data: rows,
        filters: { month: selectedMonth, year: selectedYear, sellerId: sellerFilter ?? null },
        pagination: { page: 1, limit: rows.length, total: rows.length, totalPages: 1 },
      });
    }

    const where = {
      ...(user.role === "SELLER" ? { sellerId: user.id } : sellerId ? { sellerId } : {}),
      ...(month && { month: parseInt(month, 10) }),
      ...(year && { year: parseInt(year, 10) }),
    };

    const [targets, total] = await Promise.all([
      prisma.monthlyTarget.findMany({
        where,
        include: { seller: { select: { id: true, name: true, email: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip,
        take: limit,
      }),
      prisma.monthlyTarget.count({ where }),
    ]);

    let enriched;
    if (user.role === "SELLER") {
      enriched = await enrichSellerTargets(user.id, targets);
    } else if (sellerId) {
      enriched = await enrichSellerTargets(sellerId, targets);
    } else {
      enriched = await Promise.all(
        targets.map(async (target) => {
          const transactionTotal = await getSellerMonthlyRevenue(
            target.sellerId,
            target.month,
            target.year
          );
          const achievedAmount = resolveAchievedAmount(target.achievedAmount, transactionTotal);
          return {
            ...target,
            ...enrichTargetMetrics(target.targetAmount, achievedAmount, target.currency),
          };
        })
      );
    }

    return NextResponse.json(paginatedResponse(enriched, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createTargetSchema.parse(body);

    const seller = await prisma.user.findFirst({
      where: { id: data.sellerId, role: "SELLER" },
    });
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const target = await prisma.monthlyTarget.upsert({
      where: {
        sellerId_month_year: {
          sellerId: data.sellerId,
          month: data.month,
          year: data.year,
        },
      },
      update: {
        targetAmount: data.targetAmount,
        currency: data.currency,
      },
      create: data,
      include: { seller: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      userId: admin.id,
      type: "TARGET_ASSIGNED",
      description: `Assigned target of ${data.targetAmount} ${data.currency} to ${seller.name} for ${data.month}/${data.year}`,
      metadata: { targetId: target.id, sellerId: data.sellerId },
    });

    await createNotification({
      userId: data.sellerId,
      type: "NEW_TARGET_ASSIGNED",
      title: "New Target Assigned",
      message: `Your monthly target for ${data.month}/${data.year} is ${data.targetAmount} ${data.currency}.`,
      metadata: { targetId: target.id, targetAmount: data.targetAmount },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}
