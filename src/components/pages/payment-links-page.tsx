"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal, Badge, Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentLink {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  provider: string;
  status: string;
  externalUrl?: string;
  createdAt: string;
  client: { id: string; name: string; email: string };
  seller?: { id: string; name: string };
}

interface Client {
  id: string;
  name: string;
}

export function PaymentLinksPage({ isAdmin }: { isAdmin?: boolean }) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", amount: "", currency: "USD", description: "", provider: "STRIPE" });

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/payment-links?${params}`);
    const data = await res.json();
    setLinks(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  useEffect(() => {
    fetch("/api/clients?limit=100").then((r) => r.json()).then((d) => setClients(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }

    toast.success("Payment link created");
    if (data.externalUrl) {
      navigator.clipboard.writeText(data.externalUrl);
      toast.info("Payment link copied to clipboard");
    }
    setModalOpen(false);
    setForm({ clientId: "", amount: "", currency: "USD", description: "", provider: "STRIPE" });
    fetchLinks();
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE": return "info" as const;
      case "PAID": return "success" as const;
      case "EXPIRED": return "warning" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Links</h1>
          <p className="text-slate-500">Create and manage payment links</p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Create Link
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select
          options={[
            { value: "", label: "All Statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "PAID", label: "Paid" },
            { value: "EXPIRED", label: "Expired" },
          ]}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-40"
        />
      </div>

      {loading ? <LoadingSpinner /> : links.length === 0 ? (
        <EmptyState title="No payment links" description="Create a payment link to get started" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-medium">Seller</th>}
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium">{link.client.name}</div>
                      <div className="text-xs text-slate-500">{link.client.email}</div>
                    </td>
                    {isAdmin && <td className="px-4 py-3">{link.seller?.name}</td>}
                    <td className="px-4 py-3 font-medium">{formatCurrency(link.amount, link.currency)}</td>
                    <td className="px-4 py-3"><Badge variant="info">{link.provider}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(link.status)}>{link.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(link.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {link.externalUrl && link.status === "ACTIVE" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => copyLink(link.externalUrl!)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <a href={link.externalUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                            </a>
                          </>
                        )}
                      </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Payment Link">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Client"
            options={[{ value: "", label: "Select client..." }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            required
          />
          <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <Select
            label="Currency"
            options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }]}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
          <Select
            label="Payment Provider"
            options={[{ value: "STRIPE", label: "Stripe" }, { value: "PAYPAL", label: "PayPal" }]}
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Link</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
