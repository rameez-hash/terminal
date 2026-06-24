import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TargetsPage } from "@/components/pages/targets-page";

export default async function SellerTargetPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <TargetsPage />
    </DashboardLayout>
  );
}
