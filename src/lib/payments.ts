import { prisma } from "@/lib/prisma";
import { getCurrentMonthYear, toJson } from "@/lib/utils";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { broadcastEvent } from "@/lib/pusher";
import { updateTargetProgress } from "@/lib/targets";

export async function recordManualPayment({
  sellerId,
  clientId,
  amount,
  currency,
  description,
  paymentLinkId,
  recordedByUserId,
}: {
  sellerId: string;
  clientId: string;
  amount: number;
  currency: string;
  description?: string;
  paymentLinkId?: string;
  recordedByUserId: string;
}) {
  const [client, seller] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { id: true, name: true } }),
  ]);

  if (!client) throw new Error("Client not found");
  if (!seller) throw new Error("Seller not found");

  if (paymentLinkId) {
    const link = await prisma.paymentLink.findUnique({ where: { id: paymentLinkId } });
    if (!link) throw new Error("Payment link not found");
    if (link.status === "PAID") throw new Error("Payment link is already paid");
    if (link.sellerId !== sellerId) throw new Error("Payment link does not belong to this seller");
  }

  const externalId = `manual_${paymentLinkId || clientId}_${Date.now()}`;

  const transaction = await prisma.transaction.create({
    data: {
      sellerId,
      clientId,
      paymentLinkId: paymentLinkId || null,
      amount,
      currency,
      provider: "MANUAL",
      status: "COMPLETED",
      externalId,
      metadata: toJson({ description, manual: true, recordedBy: recordedByUserId }),
    },
    include: {
      client: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });

  if (paymentLinkId) {
    await prisma.paymentLink.update({
      where: { id: paymentLinkId },
      data: { status: "PAID" },
    });
  }

  await updateTargetProgress(sellerId, amount, currency);

  await logActivity({
    userId: recordedByUserId,
    type: "PAYMENT_SUCCESS",
    description: `Manual payment of ${amount} ${currency} recorded for ${client.name}`,
    metadata: { transactionId: transaction.id, provider: "MANUAL", manual: true },
  });

  await createNotification({
    userId: sellerId,
    type: "PAYMENT_RECEIVED",
    title: "Manual Payment Recorded",
    message: `A manual payment of ${amount} ${currency} was recorded for ${client.name}.`,
    metadata: { transactionId: transaction.id, amount, currency },
  });

  if (amount >= 5000) {
    await notifyAdmins({
      type: "HIGH_VALUE_TRANSACTION",
      title: "High Value Manual Payment",
      message: `${seller.name} received a manual payment of ${amount} ${currency}.`,
      metadata: { transactionId: transaction.id, sellerId, amount },
    });
  }

  await broadcastEvent("admin-dashboard", "payment-received", {
    transactionId: transaction.id,
    amount,
    currency,
    sellerId,
  });

  await broadcastEvent(`user-${sellerId}`, "payment-received", {
    transactionId: transaction.id,
    amount,
    currency,
  });

  return transaction;
}

export function getMonthYearFromDate(date: Date) {
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export async function getSellerMonthlyRevenue(
  sellerId: string,
  month: number,
  year: number
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await prisma.transaction.aggregate({
    where: {
      sellerId,
      status: "COMPLETED",
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amount: true },
  });

  return result._sum.amount || 0;
}

export async function getSellerRevenueByMonth(sellerId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { sellerId, status: "COMPLETED" },
    select: { amount: true, createdAt: true },
  });

  const map = new Map<string, number>();
  for (const tx of transactions) {
    const date = new Date(tx.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    map.set(key, (map.get(key) || 0) + tx.amount);
  }
  return map;
}

export function resolveAchievedAmount(stored: number, transactionTotal: number) {
  return Math.max(stored, transactionTotal);
}

export function enrichTargetMetrics(
  targetAmount: number,
  achievedAmount: number,
  currency: string
) {
  const completionPercentage =
    targetAmount > 0 ? Math.min(100, Math.round((achievedAmount / targetAmount) * 100)) : 0;
  return {
    targetAmount,
    achievedAmount,
    currency,
    completionPercentage,
    remainingAmount: Math.max(0, targetAmount - achievedAmount),
  };
}

export async function enrichSellerTargets<
  T extends {
    sellerId: string;
    month: number;
    year: number;
    targetAmount: number;
    achievedAmount: number;
    currency: string;
  },
>(sellerId: string, targets: T[]) {
  const revenueByMonth = await getSellerRevenueByMonth(sellerId);

  return targets.map((target) => {
    const key = `${target.year}-${target.month}`;
    const transactionTotal = revenueByMonth.get(key) || 0;
    const achievedAmount = resolveAchievedAmount(target.achievedAmount, transactionTotal);
    return {
      ...target,
      ...enrichTargetMetrics(target.targetAmount, achievedAmount, target.currency),
    };
  });
}

export async function getCurrentMonthTargetForSeller(sellerId: string) {
  const { month, year } = getCurrentMonthYear();
  const target = await prisma.monthlyTarget.findUnique({
    where: { sellerId_month_year: { sellerId, month, year } },
  });

  if (!target) return null;

  const transactionTotal = await getSellerMonthlyRevenue(sellerId, month, year);
  const achievedAmount = resolveAchievedAmount(target.achievedAmount, transactionTotal);

  return {
    ...target,
    ...enrichTargetMetrics(target.targetAmount, achievedAmount, target.currency),
  };
}
