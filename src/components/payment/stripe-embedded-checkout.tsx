"use client";

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMemo } from "react";

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  publishableKey: string;
}

export function StripeEmbeddedCheckout({ clientSecret, publishableKey }: StripeEmbeddedCheckoutProps) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
