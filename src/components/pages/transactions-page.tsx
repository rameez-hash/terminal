"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge, Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: string;
  client: { name: string; email: string };
  seller?: { name: string };
}

export function TransactionsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [providerFilter, setProviderFilter] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (providerFilter) params.set("provider", providerFilter);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, providerFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const exportData = (format: string) => {
    window.open(`/api/export?type=transactions&format=${format}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-slate-500">View payment transaction history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData("excel")}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("pdf")}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <Select
        options={[
          { value: "", label: "All Providers" },
          { value: "STRIPE", label: "Stripe" },
          { value: "PAYPAL", label: "PayPal" },
        ]}
        value={providerFilter}
        onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
        className="w-40"
      />

      {loading ? <LoadingSpinner /> : transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-medium">Seller</th>}
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{tx.client.name}</div>
                      <div className="text-xs text-slate-500">{tx.client.email}</div>
                    </td>
                    {isAdmin && <td className="px-4 py-3">{tx.seller?.name}</td>}
                    <td className="px-4 py-3 font-medium text-green-600">{formatCurrency(tx.amount, tx.currency)}</td>
                    <td className="px-4 py-3"><Badge variant="info">{tx.provider}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={tx.status === "COMPLETED" ? "success" : "warning"}>{tx.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
