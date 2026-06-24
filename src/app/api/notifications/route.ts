import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(searchParams);
    const unreadOnly = searchParams.get("unread") === "true";

    const where = {
      userId: user.id,
      ...(unreadOnly && { read: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    return NextResponse.json({
      ...paginatedResponse(notifications, total, page, limit),
      unreadCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const { ids, markAllRead } = await request.json();

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ message: "All notifications marked as read" });
    }

    if (ids?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: user.id },
        data: { read: true },
      });
    }

    return NextResponse.json({ message: "Notifications updated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
