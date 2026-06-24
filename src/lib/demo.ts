export function isDemoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  return !process.env.STRIPE_SECRET_KEY && !process.env.PAYPAL_CLIENT_ID;
}

export function getBrandedPaymentUrl(paymentLinkId: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/pay/${paymentLinkId}`;
}
