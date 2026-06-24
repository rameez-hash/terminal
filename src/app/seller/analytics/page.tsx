import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ReportsPage } from "@/components/pages/reports-page";

export default async function SellerAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <ReportsPage />
    </DashboardLayout>
  );
}
