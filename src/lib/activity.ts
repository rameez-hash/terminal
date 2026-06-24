import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/utils";
import type { ActivityType } from "@/generated/prisma/client";

export async function logActivity({
  userId,
  type,
  description,
  metadata,
  ipAddress,
  userAgent,
}: {
  userId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.activityLog.create({
    data: {
      userId,
      type,
      description,
      metadata: toJson(metadata),
      ipAddress,
      userAgent,
    },
  });
}
