import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { getCollectionDashboardSummary } from "@/_pages/dashboard/api/queries";
import { DashboardRoute } from "@/_pages/dashboard/index.server";
import type { DashboardActivityItem } from "@/_pages/dashboard/model/contracts";
import { requireAuthenticatedAdministratorForPage } from "@/shared/auth/require-admin";
import { inProgressStatuses } from "@/shared/model/collection-status";

export const dynamic = "force-dynamic";

export default async function DashboardPageRoute() {
  await requireAuthenticatedAdministratorForPage();

  let activities: DashboardActivityItem[] = [];
  let inProgressCount = 0;
  let readyForDeliveryCount = 0;
  let loadFailed = false;

  try {
    const [summary, result] = await Promise.all([
      getCollectionDashboardSummary(),
      listCollections({
        statuses: [...inProgressStatuses],
        limit: 3,
      }),
    ]);
    inProgressCount = summary.inProgress;
    readyForDeliveryCount = summary.readyForDelivery;
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

  return (
    <DashboardRoute
      activities={activities}
      inProgressCount={inProgressCount}
      readyForDeliveryCount={readyForDeliveryCount}
      loadFailed={loadFailed}
    />
  );
}
