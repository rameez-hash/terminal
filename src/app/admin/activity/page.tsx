import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ActivityPage } from "@/components/pages/activity-page";

export default async function AdminActivityPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");
  return (
    <DashboardLayout role="SUPER_ADMIN" userName={session.user.name}>
      <ActivityPage />
    </DashboardLayout>
  );
}
