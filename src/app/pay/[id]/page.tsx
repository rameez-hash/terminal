"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, LoadingSpinner } from "@/components/ui/modal";
import { StripeEmbeddedCheckout } from "@/components/payment/stripe-embedded-checkout";
import { PayPalEmbeddedCheckout } from "@/components/payment/paypal-embedded-checkout";
import { PaymentBrandHeader, resolveBrand } from "@/components/payment/payment-brand-header";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CreditCard, CheckCircle, Loader2, ShieldCheck } from "lucide-react";

interface PaymentLinkData {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  provider: string;
  status: string;
  externalUrl?: string;
  client: { name: string; email: string };
  seller: { name: string };
  brand?: {
    name: string;
    logo?: string | null;
    primaryColor?: string | null;
    tagline?: string | null;
  } | null;
}

interface CheckoutConfig {
  mode: "demo" | "stripe_embedded" | "paypal_embedded";
  clientSecret?: string;
  publishableKey?: string;
  clientId?: string;
  currency?: string;
}

function PayPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isSuccess = searchParams.get("success") === "true";
  const isCancelled = searchParams.get("cancelled") === "true";

  const [link, setLink] = useState<PaymentLinkData | null>(null);
  const [checkout, setCheckout] = useState<CheckoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(isSuccess);

  useEffect(() => {
    fetch(`/api/payment-links/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setLink(data);
        if (data.status === "PAID" || isSuccess) setPaid(true);
      })
      .finally(() => setLoading(false));
  }, [id, isSuccess]);

  useEffect(() => {
    if (!link || link.status === "PAID" || paid) return;

    fetch(`/api/payment-links/${id}/checkout`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setCheckout(data);
      });
  }, [link, id, paid]);

  const handleDemoPay = async () => {
    setPaying(true);
    try {
      const res = await fetch(`/api/payment-links/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      setPaid(true);
      toast.success("Payment successful!");
    } catch {
      toast.error("Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!link || "error" in link) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md p-8 text-center">
          <p className="text-red-500">Payment link not found or expired</p>
        </Card>
      </div>
    );
  }

  const brand = resolveBrand(link.brand);
  const accentColor = brand.primaryColor || "#2563eb";

  if (paid || link.status === "PAID") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <Card className="w-full max-w-md p-8 text-center">
          <PaymentBrandHeader brand={brand} />
          <CheckCircle className="mx-auto mt-6 h-16 w-16 text-green-500" />
          <h1 className="mt-4 text-2xl font-bold">Payment Successful!</h1>
          <p className="mt-2 text-slate-500">
            {formatCurrency(link.amount, link.currency)} paid to {brand.name}
          </p>
          <p className="mt-1 text-sm text-slate-400">Thank you for your payment</p>
        </Card>
      </div>
    );
  }

  if (isCancelled) {
    toast.error("Payment was cancelled");
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 dark:bg-slate-950">
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <PaymentBrandHeader brand={brand} />
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              SSL Secured
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Pay to</span>
              <span className="font-medium">{brand.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Handled by</span>
              <span className="font-medium">{link.seller.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Client</span>
              <span className="font-medium">{link.client.name}</span>
            </div>
            {link.description && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">For</span>
                <span>{link.description}</span>
              </div>
            )}
            <div
              className="flex justify-between items-center rounded-lg p-3"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-2xl font-bold" style={{ color: accentColor }}>
                {formatCurrency(link.amount, link.currency)}
              </span>
            </div>
            <div className="flex gap-2">
              <Badge variant="info">{link.provider}</Badge>
              {checkout?.mode === "demo" && <Badge variant="warning">DEMO</Badge>}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {checkout?.mode === "stripe_embedded" && checkout.clientSecret && checkout.publishableKey ? (
            <div className="p-1">
              <StripeEmbeddedCheckout
                clientSecret={checkout.clientSecret}
                publishableKey={checkout.publishableKey}
              />
            </div>
          ) : checkout?.mode === "paypal_embedded" && checkout.clientId ? (
            <PayPalEmbeddedCheckout
              paymentLinkId={id}
              clientId={checkout.clientId}
              currency={checkout.currency || link.currency}
              onSuccess={() => setPaid(true)}
            />
          ) : checkout?.mode === "demo" ? (
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                <CreditCard className="h-4 w-4" />
                Demo payment — no real charge
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleDemoPay}
                loading={paying}
                style={{ backgroundColor: accentColor }}
              >
                Pay {formatCurrency(link.amount, link.currency)}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="ml-2 text-slate-500">Loading payment form...</span>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-slate-400">
          Powered by {brand.name} · Secure payment
        </p>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PayPageContent />
    </Suspense>
  );
}
