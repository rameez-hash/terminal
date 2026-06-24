import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function SellerDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <DashboardContent role="SELLER" />
    </DashboardLayout>
  );
}
