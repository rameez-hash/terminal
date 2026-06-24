"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { toast } from "sonner";

interface PayPalEmbeddedCheckoutProps {
  paymentLinkId: string;
  clientId: string;
  currency: string;
  onSuccess: () => void;
}

export function PayPalEmbeddedCheckout({
  paymentLinkId,
  clientId,
  currency,
  onSuccess,
}: PayPalEmbeddedCheckoutProps) {
  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency,
        intent: "capture",
        components: "buttons",
      }}
    >
      <div className="p-4">
        <PayPalButtons
          style={{
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
          }}
          createOrder={async () => {
            const res = await fetch(`/api/payment-links/${paymentLinkId}/paypal/order`, {
              method: "POST",
            });
            const data = await res.json();
            if (!res.ok) {
              toast.error(data.error || "Failed to create PayPal order");
              throw new Error(data.error);
            }
            return data.orderId;
          }}
          onApprove={async (data) => {
            const res = await fetch(`/api/payment-links/${paymentLinkId}/paypal/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const result = await res.json();
            if (!res.ok) {
              toast.error(result.error || "Payment capture failed");
              throw new Error(result.error);
            }
            toast.success("Payment successful!");
            onSuccess();
          }}
          onError={() => {
            toast.error("PayPal payment failed");
          }}
          onCancel={() => {
            toast.error("Payment cancelled");
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}
