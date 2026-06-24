"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast.success("If the email exists, a reset link has been sent.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reset Password</h2>
        <p className="mt-2 text-slate-500">
          {sent
            ? "Check your email for a reset link."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send Reset Link
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-700">
          Back to login
        </Link>
      </div>
    </div>
  );
}
