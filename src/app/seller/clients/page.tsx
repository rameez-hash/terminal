import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClientsPage } from "@/components/pages/clients-page";

export default async function SellerClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <ClientsPage userId={session.user.id} />
    </DashboardLayout>
  );
}
