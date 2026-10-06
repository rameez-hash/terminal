"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingSpinner, Pagination } from "@/components/ui/modal";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface TrashedSeller {
  id: string;
  name: string;
  email: string;
  status: string;
  deletedAt?: string;
  createdAt: string;
  _count?: { clientsCreated: number; transactions: number };
}

export function SellersTrashPage() {
  const [sellers, setSellers] = useState<TrashedSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search, trash: "1" });
    const res = await fetch(`/api/sellers?${params}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to load trash");
      setSellers([]);
      setLoading(false);
      return;
    }
    setSellers(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (seller: TrashedSeller) => {
    const res = await fetch(`/api/sellers/${seller.id}/restore`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to restore seller");
      return;
    }
    toast.success(`Restored ${seller.name}`);
    fetchTrash();
  };

  const handlePermanentDelete = async (seller: TrashedSeller) => {
    if (
      !confirm(
        `Permanently delete "${seller.name}"? Their clients, payment links, and transactions will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/sellers/${seller.id}?permanent=1`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to delete seller");
      return;
    }
    toast.success("Seller permanently deleted");
    fetchTrash();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seller Trash</h1>
          <p className="text-slate-500">Deleted sellers can be restored or permanently removed</p>
        </div>
        <Link href="/admin/sellers">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Back to Sellers
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Search trash..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : sellers.length === 0 ? (
        <EmptyState title="Trash is empty" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Deleted</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => (
                  <tr key={seller.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">{seller.name}</td>
                    <td className="px-4 py-3 text-slate-500">{seller.email}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {seller.deletedAt ? formatDate(seller.deletedAt) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleRestore(seller)} title="Restore">
                          <RotateCcw className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePermanentDelete(seller)}
                          title="Delete forever"
                        >
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
    </div>
  );
}
