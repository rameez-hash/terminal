import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  duplicateClientMessage,
  findClientDuplicate,
} from "@/lib/clients";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    const excludeId = searchParams.get("excludeId") || undefined;

    if (!email?.trim()) {
      return NextResponse.json({ duplicate: false });
    }

    const duplicate = await findClientDuplicate(email, phone, excludeId);
    if (!duplicate) {
      return NextResponse.json({ duplicate: false });
    }

    return NextResponse.json({
      duplicate: true,
      field: duplicate.field,
      message: duplicateClientMessage(duplicate.field),
      client: { id: duplicate.client.id, name: duplicate.client.name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
