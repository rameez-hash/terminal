"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal, ModalFooter, ModalForm, Badge, Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

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

interface Client {
  id: string;
  name: string;
}

interface Seller {
  id: string;
  name: string;
}

export function TransactionsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [providerFilter, setProviderFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    sellerId: "",
    amount: "",
    currency: "USD",
    description: "",
  });

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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/clients?limit=100")
      .then((r) => r.json())
      .then((d) => setClients(d.data || []));
    if (isAdmin) {
      fetch("/api/sellers?limit=100")
        .then((r) => r.json())
        .then((d) => setSellers(d.data || []));
    }
  }, [isAdmin]);

  const exportData = (format: string) => {
    window.open(`/api/export?type=transactions&format=${format}`, "_blank");
  };

  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          sellerId: isAdmin ? form.sellerId || undefined : undefined,
          amount: parseFloat(form.amount),
          currency: form.currency,
          description: form.description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Manual payment recorded");
      setModalOpen(false);
      setForm({ clientId: "", sellerId: "", amount: "", currency: "USD", description: "" });
      fetchTransactions();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-slate-500">View payment transaction history</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Record Manual Payment
          </Button>
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
          { value: "MANUAL", label: "Manual" },
        ]}
        value={providerFilter}
        onChange={(e) => {
          setProviderFilter(e.target.value);
          setPage(1);
        }}
        className="w-40"
      />

      {loading ? (
        <LoadingSpinner />
      ) : transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
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
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{tx.client.name}</div>
                      <div className="text-xs text-slate-500">{tx.client.email}</div>
                    </td>
                    {isAdmin && <td className="px-4 py-3">{tx.seller?.name}</td>}
                    <td className="px-4 py-3 font-medium text-green-600">
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.provider === "MANUAL" ? "warning" : "info"}>{tx.provider}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.status === "COMPLETED" ? "success" : "warning"}>{tx.status}</Badge>
                    </td>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Manual Payment"
        description="Record cash, bank transfer, or other offline payments"
        size="lg"
      >
        <ModalForm onSubmit={handleManualPayment}>
          {isAdmin && (
            <Select
              label="Seller"
              value={form.sellerId}
              onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
              options={[
                { value: "", label: "Select seller..." },
                ...sellers.map((s) => ({ value: s.id, label: s.name })),
              ]}
              required
            />
          )}
          <Select
            label="Client"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            options={[
              { value: "", label: "Select client..." },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              options={[
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
                { value: "GBP", label: "GBP" },
              ]}
            />
          </div>
          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Bank transfer, cash payment, etc."
          />
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Record Payment
            </Button>
          </ModalFooter>
        </ModalForm>
      </Modal>
    </div>
  );
}
