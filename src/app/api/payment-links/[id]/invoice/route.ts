import { NextResponse } from "next/server";
import { getPaymentLinkInvoice, invoicePdfResponse } from "@/lib/invoice";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPaymentLinkInvoice(id);

    if (!result) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if ("notPaid" in result || !("invoice" in result)) {
      return NextResponse.json(
        { error: "Invoice is only available after this payment is completed" },
        { status: 400 }
      );
    }

    return invoicePdfResponse(result.invoice);
  } catch (error) {
    console.error("Payment link invoice error:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
