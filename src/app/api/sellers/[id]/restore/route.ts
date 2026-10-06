import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER" },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (!seller.deletedAt) {
      return NextResponse.json({ error: "Seller is not in trash" }, { status: 400 });
    }

    const restored = await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: admin.id,
      type: "SELLER_RESTORED",
      description: `Restored seller ${restored.name} from trash`,
      metadata: { sellerId: id },
    });

    return NextResponse.json(restored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 }
    );
  }
}
