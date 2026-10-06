import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { findClientDuplicate, duplicateClientMessage } from "@/lib/clients";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.deletedAt) {
      return NextResponse.json({ error: "Client is not in trash" }, { status: 400 });
    }

    const duplicate = await findClientDuplicate(client.email, client.phone, id);
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Cannot restore: ${duplicateClientMessage(duplicate.field).toLowerCase()}`,
        },
        { status: 409 }
      );
    }

    const restored = await prisma.client.update({
      where: { id },
      data: { deletedAt: null },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      userId: admin.id,
      type: "CLIENT_RESTORED",
      description: `Restored client ${restored.name} from trash`,
      metadata: { clientId: id },
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
