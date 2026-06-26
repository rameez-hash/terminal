"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

interface StripePaymentFormProps {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
  onSuccess?: () => void;
}

function CheckoutForm({ returnUrl, onSuccess }: { returnUrl: string; onSuccess?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setLoading(false);
      return;
    }

    onSuccess?.();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <Button type="submit" className="mt-4 w-full" size="lg" loading={loading}>
        Pay Now
      </Button>
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  publishableKey,
  returnUrl,
  onSuccess,
}: StripePaymentFormProps) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!publishableKey) {
    return (
      <p className="p-6 text-sm text-red-500">
        Stripe publishable key is missing. Please contact support.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <CheckoutForm returnUrl={returnUrl} onSuccess={onSuccess} />
    </Elements>
  );
}
