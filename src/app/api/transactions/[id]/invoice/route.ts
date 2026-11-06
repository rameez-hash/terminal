import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCompletedTransactionInvoice, invoicePdfResponse } from "@/lib/invoice";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const result = await getCompletedTransactionInvoice(id);

    if (!result) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (user.role !== "SUPER_ADMIN" && result.transaction.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ("notPaid" in result) {
      return NextResponse.json(
        { error: "Invoice is only available for paid transactions" },
        { status: 400 }
      );
    }

    return await invoicePdfResponse(result.invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate invoice";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
