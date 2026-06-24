import { prisma } from "@/lib/prisma";
import { getCurrentMonthYear, toJson } from "@/lib/utils";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { broadcastEvent } from "@/lib/pusher";

export async function updateTargetProgress(
  sellerId: string,
  amount: number,
  currency = "USD"
) {
  const { month, year } = getCurrentMonthYear();

  const target = await prisma.monthlyTarget.findUnique({
    where: { sellerId_month_year: { sellerId, month, year } },
  });

  if (!target) return null;

  const newAchieved = target.achievedAmount + amount;
  const updated = await prisma.monthlyTarget.update({
    where: { id: target.id },
    data: { achievedAmount: newAchieved },
  });

  const completionPercentage = Math.min(
    100,
    Math.round((newAchieved / target.targetAmount) * 100)
  );

  await broadcastEvent(`user-${sellerId}`, "target-update", {
    achievedAmount: newAchieved,
    targetAmount: target.targetAmount,
    completionPercentage,
  });

  if (newAchieved >= target.targetAmount && target.achievedAmount < target.targetAmount) {
    await createNotification({
      userId: sellerId,
      type: "TARGET_COMPLETED",
      title: "Target Completed!",
      message: `Congratulations! You've reached your monthly target of ${target.targetAmount} ${currency}.`,
      metadata: { month, year, amount: target.targetAmount },
    });

    await notifyAdmins({
      type: "MONTHLY_TARGET_COMPLETED",
      title: "Seller Target Completed",
      message: `A seller has completed their monthly target for ${month}/${year}.`,
      metadata: { sellerId, month, year },
    });
  }

  return updated;
}

export async function processSuccessfulPayment({
  paymentLinkId,
  amount,
  currency,
  provider,
  externalId,
  metadata,
}: {
  paymentLinkId: string;
  amount: number;
  currency: string;
  provider: "STRIPE" | "PAYPAL";
  externalId: string;
  metadata?: Record<string, unknown>;
}) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { id: paymentLinkId },
    include: { client: true, seller: true },
  });

  if (!paymentLink) throw new Error("Payment link not found");

  const existing = await prisma.transaction.findFirst({
    where: { externalId, status: "COMPLETED" },
  });
  if (existing) return existing;

  const transaction = await prisma.transaction.create({
    data: {
      sellerId: paymentLink.sellerId,
      clientId: paymentLink.clientId,
      paymentLinkId: paymentLink.id,
      amount,
      currency,
      provider,
      status: "COMPLETED",
      externalId,
      metadata: toJson(metadata),
    },
  });

  await prisma.paymentLink.update({
    where: { id: paymentLinkId },
    data: { status: "PAID" },
  });

  await updateTargetProgress(paymentLink.sellerId, amount, currency);

  await logActivity({
    userId: paymentLink.sellerId,
    type: "PAYMENT_SUCCESS",
    description: `Payment of ${amount} ${currency} received from ${paymentLink.client.name}`,
    metadata: { transactionId: transaction.id, provider },
  });

  await createNotification({
    userId: paymentLink.sellerId,
    type: "PAYMENT_RECEIVED",
    title: "Payment Received",
    message: `You received ${amount} ${currency} from ${paymentLink.client.name}.`,
    metadata: { transactionId: transaction.id, amount, currency },
  });

  if (amount >= 5000) {
    await notifyAdmins({
      type: "HIGH_VALUE_TRANSACTION",
      title: "High Value Transaction",
      message: `${paymentLink.seller.name} received a payment of ${amount} ${currency}.`,
      metadata: { transactionId: transaction.id, sellerId: paymentLink.sellerId, amount },
    });
  }

  await broadcastEvent("admin-dashboard", "payment-received", {
    transactionId: transaction.id,
    amount,
    currency,
    sellerId: paymentLink.sellerId,
  });

  await broadcastEvent(`user-${paymentLink.sellerId}`, "payment-received", {
    transactionId: transaction.id,
    amount,
    currency,
  });

  return transaction;
}
