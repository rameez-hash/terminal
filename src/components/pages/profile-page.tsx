"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/modal";
import { toast } from "sonner";

export function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setForm((f) => ({ ...f, name: data.name, email: data.email, phone: data.phone || "" }));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, string> = { name: form.name, phone: form.phone };
    if (form.newPassword) {
      body.currentPassword = form.currentPassword;
      body.newPassword = form.newPassword;
    }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success("Profile updated");
      setForm((f) => ({ ...f, currentPassword: "", newPassword: "" }));
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-slate-500">Manage your account settings</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} disabled />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <hr className="border-slate-200 dark:border-slate-700" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Change Password</p>
          <Input label="Current Password" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          <Input label="New Password" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} minLength={8} />
          <Button type="submit" loading={saving}>Save Changes</Button>
        </form>
      </Card>
    </div>
  );
}
