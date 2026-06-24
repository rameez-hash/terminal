import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ReportsPage } from "@/components/pages/reports-page";

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");
  return (
    <DashboardLayout role="SUPER_ADMIN" userName={session.user.name}>
      <ReportsPage isAdmin />
    </DashboardLayout>
  );
}
