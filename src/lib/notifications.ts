import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/utils";
import { broadcastEvent } from "@/lib/pusher";
import type { NotificationType } from "@/generated/prisma/client";

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: toJson(metadata),
    },
  });

  await broadcastEvent(`user-${userId}`, "notification", {
    id: notification.id,
    type,
    title,
    message,
  });

  return notification;
}

export async function notifyAdmins({
  type,
  title,
  message,
  metadata,
}: {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({ userId: admin.id, type, title, message, metadata })
    )
  );
}
