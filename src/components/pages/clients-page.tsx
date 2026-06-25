"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal, ModalFooter, ModalForm, Badge, Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  notes?: string;
  createdAt: string;
  creator: { id: string; name: string };
  _count?: { paymentLinks: number; transactions: number };
}

interface ClientsPageProps {
  canEditAll?: boolean;
  userId?: string;
}

export function ClientsPage({ canEditAll, userId }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", country: "", notes: "" });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search });
    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const canEdit = (client: Client) => canEditAll || client.creator.id === userId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editClient ? `/api/clients/${editClient.id}` : "/api/clients";
    const method = editClient ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error);
      return;
    }

    toast.success(editClient ? "Client updated" : "Client created");
    setModalOpen(false);
    setEditClient(null);
    setForm({ name: "", email: "", phone: "", company: "", country: "", notes: "" });
    fetchClients();
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      company: client.company || "",
      country: client.country || "",
      notes: client.notes || "",
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-slate-500">Manage client information</p>
        </div>
        <Button onClick={() => { setEditClient(null); setForm({ name: "", email: "", phone: "", company: "", country: "", notes: "" }); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? <LoadingSpinner /> : clients.length === 0 ? (
        <EmptyState title="No clients found" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Created By</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-slate-500">{client.email}</td>
                    <td className="px-4 py-3">{client.company || "-"}</td>
                    <td className="px-4 py-3">{client.country || "-"}</td>
                    <td className="px-4 py-3">{client.creator.name}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(client.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canEdit(client) && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(client)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editClient ? "Edit Client" : "Create Client"}
        description={editClient ? "Update client details below." : "Add a new client to your account."}
        size="lg"
      >
        <ModalForm onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="sm:col-span-2" />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <ModalFooter>
            <Button variant="secondary" type="button" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {editClient ? "Update Client" : "Create Client"}
            </Button>
          </ModalFooter>
        </ModalForm>
      </Modal>
    </div>
  );
}
