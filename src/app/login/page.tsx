"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        return;
      }

      const res = await fetch("/api/profile");
      const user = await res.json();
      router.push(user.role === "SUPER_ADMIN" ? "/admin" : "/seller");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-indigo-600 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 font-bold text-xl">
            S
          </div>
          <span className="text-xl font-semibold">SalesPortal</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Enterprise Sales Management & Payment Tracking
          </h1>
          <p className="mt-4 text-lg text-indigo-200">
            Track sales, manage clients, create payment links, and monitor targets in real-time.
          </p>
        </div>
        <p className="text-sm text-indigo-300">© 2026 SalesPortal. All rights reserved.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">
                S
              </div>
              <span className="text-xl font-semibold">SalesPortal</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h2>
          <p className="mt-2 text-slate-500">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
