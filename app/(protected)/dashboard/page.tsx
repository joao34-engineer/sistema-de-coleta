import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { DashboardRoute } from "@/_pages/dashboard/index.server";
import type { DashboardActivityItem } from "@/_pages/dashboard/model/contracts";

export const dynamic = "force-dynamic";

export default async function DashboardPageRoute() {
  let activities: DashboardActivityItem[] = [];
  let loadFailed = false;

  try {
    const result = await listCollections({ limit: 50 });
    activities = result.items.map((item) => ({
      id: item.id,
      officialCode: item.officialCode,
      status: item.status,
      customerName: item.customerName,
      createdAt: item.createdAt,
    }));
  } catch {
    loadFailed = true;
  }

  return <DashboardRoute activities={activities} loadFailed={loadFailed} />;
}
