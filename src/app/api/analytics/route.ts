import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getCurrentMonthYear, getCompletionPercentage } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const isAdmin = user.role === "SUPER_ADMIN";
    const sellerId = isAdmin ? searchParams.get("sellerId") : user.id;
    const { month, year } = getCurrentMonthYear();

    const sellerFilter = sellerId ? { sellerId } : {};
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const [
      totalSellers,
      totalClients,
      totalRevenueResult,
      monthlyRevenueResult,
      activePaymentLinks,
      targets,
      targetHistory,
      topSellers,
      monthlySales,
      revenueByProvider,
      revenueBySeller,
    ] = await Promise.all([
      isAdmin ? prisma.user.count({ where: { role: "SELLER", status: "ACTIVE" } }) : Promise.resolve(0),
      prisma.client.count({ where: sellerId ? { createdBy: sellerId } : undefined }),
      prisma.transaction.aggregate({
        where: { status: "COMPLETED", ...sellerFilter },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: monthStart, lte: monthEnd },
          ...sellerFilter,
        },
        _sum: { amount: true },
      }),
      prisma.paymentLink.count({
        where: { status: "ACTIVE", ...sellerFilter },
      }),
      prisma.monthlyTarget.findMany({
        where: {
          month,
          year,
          ...(sellerId ? { sellerId } : {}),
        },
        include: { seller: { select: { id: true, name: true } } },
      }),
      !isAdmin
        ? prisma.monthlyTarget.findMany({
            where: { sellerId: user.id },
            orderBy: [{ year: "desc" }, { month: "desc" }],
            take: 12,
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.transaction.groupBy({
            by: ["sellerId"],
            where: { status: "COMPLETED", createdAt: { gte: monthStart, lte: monthEnd } },
            _sum: { amount: true },
            _count: true,
            orderBy: { _sum: { amount: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
      getMonthlySalesFallback(sellerFilter),
      prisma.transaction.groupBy({
        by: ["provider"],
        where: { status: "COMPLETED", ...sellerFilter },
        _sum: { amount: true },
      }),
      isAdmin
        ? prisma.transaction.groupBy({
            by: ["sellerId"],
            where: { status: "COMPLETED" },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve([]),
    ]);

    const totalRevenue = totalRevenueResult._sum.amount || 0;
    const monthlyRevenue = monthlyRevenueResult._sum.amount || 0;

    const targetAchievementRate =
      targets.length > 0
        ? Math.round(
            targets.reduce(
              (acc, t) => acc + getCompletionPercentage(t.achievedAmount, t.targetAmount),
              0
            ) / targets.length
          )
        : 0;

    const pendingTargets = targets.filter(
      (t) => t.achievedAmount < t.targetAmount
    ).length;

    let topPerformingSellers: Array<{
      id: string;
      name: string;
      revenue: number;
      transactionCount: number;
    }> = [];

    if (isAdmin && topSellers.length > 0) {
      const sellerIds = topSellers.map((s) => s.sellerId);
      const sellers = await prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, name: true },
      });
      topPerformingSellers = topSellers.map((s) => ({
        id: s.sellerId,
        name: sellers.find((sel) => sel.id === s.sellerId)?.name || "Unknown",
        revenue: s._sum.amount || 0,
        transactionCount: s._count,
      }));
    }

    let sellerPerformance: Array<{
      id: string;
      name: string;
      revenue: number;
      transactionCount: number;
    }> = [];

    if (isAdmin && revenueBySeller.length > 0) {
      const sellerIds = revenueBySeller.map((s) => s.sellerId);
      const sellers = await prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, name: true },
      });
      sellerPerformance = revenueBySeller.map((s) => ({
        id: s.sellerId,
        name: sellers.find((sel) => sel.id === s.sellerId)?.name || "Unknown",
        revenue: s._sum.amount || 0,
        transactionCount: s._count,
      }));
    }

    const currentTarget = sellerId
      ? targets.find((t) => t.sellerId === sellerId)
      : targets[0];

    return NextResponse.json({
      stats: {
        totalSellers,
        totalClients,
        totalRevenue,
        monthlyRevenue,
        activePaymentLinks,
        targetAchievementRate,
        pendingTargets,
      },
      currentTarget: currentTarget
        ? {
            ...currentTarget,
            completionPercentage: getCompletionPercentage(
              currentTarget.achievedAmount,
              currentTarget.targetAmount
            ),
            remainingAmount: Math.max(
              0,
              currentTarget.targetAmount - currentTarget.achievedAmount
            ),
          }
        : null,
      monthlyTargetHistory: targetHistory.map((t) => ({
        id: t.id,
        month: t.month,
        year: t.year,
        targetAmount: t.targetAmount,
        achievedAmount: t.achievedAmount,
        currency: t.currency,
        completionPercentage: getCompletionPercentage(t.achievedAmount, t.targetAmount),
        remainingAmount: Math.max(0, t.targetAmount - t.achievedAmount),
      })),
      topPerformingSellers,
      sellerPerformance,
      revenueByProvider: revenueByProvider.map((r) => ({
        provider: r.provider,
        revenue: r._sum.amount || 0,
      })),
      monthlySales,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

async function getMonthlySalesFallback(sellerFilter: { sellerId?: string }) {
  const transactions = await prisma.transaction.findMany({
    where: { status: "COMPLETED", ...sellerFilter },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const grouped: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = t.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    grouped[key] = (grouped[key] || 0) + t.amount;
  });

  return Object.entries(grouped).map(([month, revenue]) => ({ month, revenue }));
}
