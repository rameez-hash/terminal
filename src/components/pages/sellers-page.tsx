"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal, ModalFooter, ModalForm, Badge, Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { toast } from "sonner";
import { formatDate, getCurrentMonthYear, getMonthOptions, getYearOptions } from "@/lib/utils";

interface Seller {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  createdAt: string;
  _count: { clientsCreated: number; paymentLinks: number; transactions: number };
}

export function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editSeller, setEditSeller] = useState<Seller | null>(null);
  const [targetModal, setTargetModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [targetForm, setTargetForm] = useState({
    targetAmount: "",
    currency: "USD",
    month: String(currentMonth),
    year: String(currentYear),
  });

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search });
    const res = await fetch(`/api/sellers?${params}`);
    const data = await res.json();
    setSellers(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchSellers(); }, [fetchSellers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editSeller ? `/api/sellers/${editSeller.id}` : "/api/sellers";
    const method = editSeller ? "PATCH" : "POST";
    const body = editSeller
      ? { name: form.name, phone: form.phone, ...(form.password && { password: form.password }) }
      : form;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error);
      return;
    }

    toast.success(editSeller ? "Seller updated" : "Seller created");
    setModalOpen(false);
    setEditSeller(null);
    setForm({ name: "", email: "", password: "", phone: "" });
    fetchSellers();
  };

  const handleSuspend = async (seller: Seller) => {
    const newStatus = seller.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await fetch(`/api/sellers/${seller.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success(`Seller ${newStatus === "SUSPENDED" ? "suspended" : "activated"}`);
    fetchSellers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this seller?")) return;
    await fetch(`/api/sellers/${id}`, { method: "DELETE" });
    toast.success("Seller deleted");
    fetchSellers();
  };

  const handleAssignTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    const res = await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: selectedSeller.id,
        month: parseInt(targetForm.month, 10),
        year: parseInt(targetForm.year, 10),
        targetAmount: parseFloat(targetForm.targetAmount),
        currency: targetForm.currency,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error);
      return;
    }
    toast.success("Target assigned");
    setTargetModal(false);
    setTargetForm({
      targetAmount: "",
      currency: "USD",
      month: String(currentMonth),
      year: String(currentYear),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sellers</h1>
          <p className="text-slate-500">Manage seller accounts and targets</p>
        </div>
        <Button onClick={() => { setEditSeller(null); setForm({ name: "", email: "", password: "", phone: "" }); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Seller
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Search sellers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? <LoadingSpinner /> : sellers.length === 0 ? (
        <EmptyState title="No sellers found" description="Create your first seller to get started" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Clients</th>
                  <th className="px-4 py-3 text-left font-medium">Transactions</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => (
                  <tr key={seller.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{seller.name}</td>
                    <td className="px-4 py-3 text-slate-500">{seller.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={seller.status === "ACTIVE" ? "success" : "danger"}>{seller.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{seller._count.clientsCreated}</td>
                    <td className="px-4 py-3">{seller._count.transactions}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(seller.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedSeller(seller); setTargetModal(true); }} title="Assign Target">
                          <Target className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditSeller(seller); setForm({ name: seller.name, email: seller.email, password: "", phone: seller.phone || "" }); setModalOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleSuspend(seller)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(seller.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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
        title={editSeller ? "Edit Seller" : "Create Seller"}
        description={editSeller ? "Update seller account details." : "Add a new seller to the platform."}
      >
        <ModalForm onSubmit={handleSubmit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editSeller} />
          <Input label={editSeller ? "New Password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editSeller} />
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <ModalFooter>
            <Button variant="secondary" type="button" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {editSeller ? "Update Seller" : "Create Seller"}
            </Button>
          </ModalFooter>
        </ModalForm>
      </Modal>

      <Modal
        open={targetModal}
        onClose={() => setTargetModal(false)}
        title={`Assign Target${selectedSeller ? ` — ${selectedSeller.name}` : ""}`}
        description="Set a monthly sales target for this seller."
      >
        <ModalForm onSubmit={handleAssignTarget}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Month"
              value={targetForm.month}
              onChange={(e) => setTargetForm({ ...targetForm, month: e.target.value })}
              options={getMonthOptions()}
            />
            <Select
              label="Year"
              value={targetForm.year}
              onChange={(e) => setTargetForm({ ...targetForm, year: e.target.value })}
              options={getYearOptions()}
            />
          </div>
          <Input label="Target Amount" type="number" step="0.01" min="0" value={targetForm.targetAmount} onChange={(e) => setTargetForm({ ...targetForm, targetAmount: e.target.value })} required />
          <Select label="Currency" options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }]} value={targetForm.currency} onChange={(e) => setTargetForm({ ...targetForm, currency: e.target.value })} />
          <ModalFooter>
            <Button variant="secondary" type="button" className="w-full sm:w-auto" onClick={() => setTargetModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Assign Target
            </Button>
          </ModalFooter>
        </ModalForm>
      </Modal>
    </div>
  );
}

function Target(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
