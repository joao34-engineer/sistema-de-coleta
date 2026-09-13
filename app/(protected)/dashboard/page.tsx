import { listCollections } from "@/_pages/collection-lifecycle/index.server";
import { DashboardRoute, getCollectionDashboardSummary, type DashboardActivityItem } from "@/_pages/dashboard/index.server";
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
        limit: 2,
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
