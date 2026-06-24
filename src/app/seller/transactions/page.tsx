import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TransactionsPage } from "@/components/pages/transactions-page";

export default async function SellerTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <TransactionsPage />
    </DashboardLayout>
  );
}
