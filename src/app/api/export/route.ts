import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";
    const type = searchParams.get("type") || "transactions";

    const isAdmin = user.role === "SUPER_ADMIN";
    const sellerFilter = isAdmin ? {} : { sellerId: user.id };

    let data: Record<string, unknown>[] = [];
    let filename = "export";

    if (type === "transactions") {
      const transactions = await prisma.transaction.findMany({
        where: { status: "COMPLETED", ...sellerFilter },
        include: {
          client: { select: { name: true, email: true } },
          seller: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      data = transactions.map((t) => ({
        Date: t.createdAt.toISOString().split("T")[0],
        Client: t.client.name,
        Seller: t.seller.name,
        Amount: t.amount,
        Currency: t.currency,
        Provider: t.provider,
        Status: t.status,
      }));
      filename = "transactions-report";
    } else if (type === "sellers" && isAdmin) {
      const sellers = await prisma.user.findMany({
        where: { role: "SELLER" },
        include: {
          _count: { select: { clientsCreated: true, transactions: true } },
        },
      });
      data = sellers.map((s) => ({
        Name: s.name,
        Email: s.email,
        Status: s.status,
        Clients: s._count.clientsCreated,
        Transactions: s._count.transactions,
        Created: s.createdAt.toISOString().split("T")[0],
      }));
      filename = "sellers-report";
    } else if (type === "clients") {
      const clients = await prisma.client.findMany({
        where: isAdmin ? {} : { createdBy: user.id },
        include: { creator: { select: { name: true } } },
      });
      data = clients.map((c) => ({
        Name: c.name,
        Email: c.email,
        Company: c.company || "",
        Country: c.country || "",
        CreatedBy: c.creator.name,
        Created: c.createdAt.toISOString().split("T")[0],
      }));
      filename = "clients-report";
    }

    if (format === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`${filename.replace("-", " ").toUpperCase()}`, 14, 20);

      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const rows = data.map((row) => headers.map((h) => String(row[h] ?? "")));
        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 30,
        });
      }

      const pdfBuffer = doc.output("arraybuffer");
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
