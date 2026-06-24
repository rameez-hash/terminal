import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PaymentLinksPage } from "@/components/pages/payment-links-page";

export default async function SellerPaymentLinksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <PaymentLinksPage />
    </DashboardLayout>
  );
}
