import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getLiveAnalytics } from "@/lib/analytics/live-dashboard";

export default async function AnalyticsPage() { return <AnalyticsDashboard initialData={await getLiveAnalytics(30)} />; }
