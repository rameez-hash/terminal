import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProfilePage } from "@/components/pages/profile-page";

export default async function SellerProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <DashboardLayout role="SELLER" userName={session.user.name}>
      <ProfilePage />
    </DashboardLayout>
  );
}
