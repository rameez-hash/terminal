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
  seller?: { id: string; name: string; role: string };
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
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({ clientId: "", amount: "", currency: "USD", description: "", provider: "STRIPE" });
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const resetModal = () => {
    setClientMode("existing");
    setForm({ clientId: "", amount: "", currency: "USD", description: "", provider: "STRIPE" });
    setNewClient({ name: "", email: "", phone: "" });
  };

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/clients?limit=100");
    const data = await res.json();
    setClients(data.data || []);
  }, []);

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
    fetchClients();
  }, [fetchClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let clientId = form.clientId;

      if (clientMode === "new") {
        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newClient),
        });
        const clientData = await clientRes.json();
        if (!clientRes.ok) {
          toast.error(clientData.error || "Failed to create client");
          return;
        }
        clientId = clientData.id;
        await fetchClients();
      }

      if (!clientId) {
        toast.error("Please select or add a client");
        return;
      }

      const res = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amount: parseFloat(form.amount),
          currency: form.currency,
          description: form.description,
          provider: form.provider,
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
      resetModal();
      fetchLinks();
    } finally {
      setSubmitting(false);
    }
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
        <Button onClick={() => { resetModal(); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Create Link
        </Button>
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
                  {isAdmin && <th className="px-4 py-3 text-left font-medium">Created By</th>}
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
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="font-medium">{link.seller?.name}</div>
                        <div className="mt-0.5">
                          <Badge variant={link.seller?.role === "SUPER_ADMIN" ? "warning" : "default"}>
                            {link.seller?.role === "SUPER_ADMIN" ? "Admin" : "Seller"}
                          </Badge>
                        </div>
                      </td>
                    )}
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

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetModal(); }} title="Create Payment Link">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Client</label>
            <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setClientMode("existing")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  clientMode === "existing"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Existing Client
              </button>
              <button
                type="button"
                onClick={() => setClientMode("new")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  clientMode === "new"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                + New Client
              </button>
            </div>
          </div>

          {clientMode === "existing" ? (
            <Select
              label="Select Client"
              options={[{ value: "", label: "Select client..." }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
            />
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <Input
                label="Client Name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="client@company.com"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                required
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+1 555 0100"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
              <p className="text-xs text-slate-500">Email and phone must be unique across all clients.</p>
            </div>
          )}
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
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); resetModal(); }}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create Link</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
