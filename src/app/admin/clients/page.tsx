import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClientsPage } from "@/components/pages/clients-page";

export default async function AdminClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");
  return (
    <DashboardLayout role="SUPER_ADMIN" userName={session.user.name}>
      <ClientsPage canEditAll />
    </DashboardLayout>
  );
}
