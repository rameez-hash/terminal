import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { parsePaginationParams, paginatedResponse } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePaginationParams(searchParams);
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");

    const where = {
      ...(user.role === "SELLER" ? { userId: user.id } : userId ? { userId } : {}),
      ...(type && { type: type as never }),
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(logs, total, page, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
