import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { getDashboardData } from "@/lib/admin/dashboard";

export default async function DashboardPage() {
  return <DashboardOverview initialData={await getDashboardData()} />;
}
