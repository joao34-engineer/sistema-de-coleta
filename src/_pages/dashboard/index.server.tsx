import "server-only";

import { requireAuthenticatedAdministratorForPage } from "@/shared/auth/require-admin";
import type { DashboardActivityItem } from "./model/contracts";
import { formatDashboardDateLabel } from "./model/contracts";
import { DashboardPage } from "./ui/dashboard-page";

export { getCollectionDashboardSummary } from "./api/queries";
export type { DashboardActivityItem } from "./model/contracts";

type Props = Readonly<{
  activities: ReadonlyArray<DashboardActivityItem>;
  inProgressCount: number;
  readyForDeliveryCount: number;
  loadFailed: boolean;
}>;

export async function DashboardRoute({ activities, inProgressCount, readyForDeliveryCount, loadFailed }: Props) {
  const administrator = await requireAuthenticatedAdministratorForPage();
  return (
    <DashboardPage
      administrator={administrator}
      activities={activities}
      inProgressCount={inProgressCount}
      readyForDeliveryCount={readyForDeliveryCount}
      loadFailed={loadFailed}
      todayLabel={formatDashboardDateLabel()}
    />
  );
}
