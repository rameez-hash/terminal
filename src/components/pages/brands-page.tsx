"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Modal, ModalFooter, ModalForm, Badge, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { toast } from "sonner";

interface Brand {
  id: string;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  tagline?: string | null;
  isActive: boolean;
  _count?: { paymentLinks: number };
}

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState({
    name: "",
    logo: "",
    primaryColor: "#2563eb",
    tagline: "",
    isActive: true,
  });

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/brands/manage");
    const data = await res.json();
    setBrands(data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const openCreate = () => {
    setEditBrand(null);
    setForm({ name: "", logo: "", primaryColor: "#2563eb", tagline: "", isActive: true });
    setModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditBrand(brand);
    setForm({
      name: brand.name,
      logo: brand.logo || "",
      primaryColor: brand.primaryColor || "#2563eb",
      tagline: brand.tagline || "",
      isActive: brand.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editBrand ? `/api/brands/${editBrand.id}` : "/api/brands";
    const method = editBrand ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        logo: form.logo || null,
        primaryColor: form.primaryColor || null,
        tagline: form.tagline || null,
        isActive: form.isActive,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }

    toast.success(editBrand ? "Brand updated" : "Brand created");
    setModalOpen(false);
    fetchBrands();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this brand?")) return;
    const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }
    toast.success("Brand deleted");
    fetchBrands();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brands</h1>
          <p className="text-slate-500">Manage brands shown on payment links shared with clients</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Brand
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : brands.length === 0 ? (
        <EmptyState title="No brands yet" description="Add a brand to use when creating payment links" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700"
                    style={{ borderColor: brand.primaryColor || undefined }}
                  >
                    {brand.logo ? (
                      <Image
                        src={brand.logo}
                        alt={brand.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span
                        className="text-lg font-bold text-white"
                        style={{ backgroundColor: brand.primaryColor || "#2563eb" }}
                      >
                        {brand.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{brand.name}</p>
                    {brand.tagline && <p className="text-xs text-slate-500">{brand.tagline}</p>}
                    <div className="mt-1 flex gap-2">
                      <Badge variant={brand.isActive ? "success" : "default"}>
                        {brand.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="info">{brand._count?.paymentLinks || 0} links</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(brand)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(brand.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editBrand ? "Edit Brand" : "Add Brand"}
        description="Logo path example: /logo-rename.png (file in public folder)"
        size="lg"
      >
        <ModalForm onSubmit={handleSubmit}>
          <Input
            label="Brand Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Logo URL or Path"
            value={form.logo}
            onChange={(e) => setForm({ ...form, logo: e.target.value })}
            placeholder="/logo-rename.png"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Primary Color"
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            />
            <Input
              label="Tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Secure Payment"
            />
          </div>
          {form.logo && (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-2 text-xs text-slate-500">Preview</p>
              <div className="flex items-center gap-3">
                <Image src={form.logo} alt="Preview" width={40} height={40} className="h-10 w-auto object-contain" />
                <div>
                  <p className="font-semibold" style={{ color: form.primaryColor }}>{form.name || "Brand Name"}</p>
                  <p className="text-xs text-slate-500">{form.tagline || "Secure Payment"}</p>
                </div>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-slate-300"
            />
            Active (visible when creating payment links)
          </label>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editBrand ? "Update Brand" : "Create Brand"}</Button>
          </ModalFooter>
        </ModalForm>
      </Modal>
    </div>
  );
}
