"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { toast } from "sonner";

interface PayPalEmbeddedCheckoutProps {
  paymentLinkId: string;
  clientId: string;
  currency: string;
  onSuccess: () => void;
}

function parsePayPalError(err: unknown): string {
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.details === "string" && record.details) return record.details;
  }
  return "Payment could not be completed. Please try again or use PayPal account.";
}

export function PayPalEmbeddedCheckout({
  paymentLinkId,
  clientId,
  currency,
  onSuccess,
}: PayPalEmbeddedCheckoutProps) {
  if (!clientId) {
    return (
      <p className="p-6 text-sm text-red-500">
        PayPal client ID is missing. Please contact support.
      </p>
    );
  }

  const createOrder = async () => {
    const res = await fetch(`/api/payment-links/${paymentLinkId}/paypal/order`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data.error || "Failed to create PayPal order";
      toast.error(message);
      throw new Error(message);
    }
    return data.orderId;
  };

  const onApprove = async (data: { orderID?: string }) => {
    const res = await fetch(`/api/payment-links/${paymentLinkId}/paypal/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: data.orderID }),
    });
    const result = await res.json();
    if (!res.ok) {
      const message = result.error || "Payment capture failed";
      toast.error(message);
      throw new Error(message);
    }
    toast.success("Payment successful!");
    onSuccess();
  };

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: currency.toUpperCase(),
        intent: "capture",
        components: "buttons",
        enableFunding: "card,venmo,paylater",
      }}
    >
      <div className="p-6">
        <PayPalButtons
          style={{
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: 48,
          }}
          createOrder={createOrder}
          onApprove={onApprove}
          onError={(err) => {
            console.error("PayPal error:", err);
            toast.error(parsePayPalError(err));
          }}
          onCancel={() => toast.error("Payment cancelled")}
        />
      </div>
    </PayPalScriptProvider>
  );
}
