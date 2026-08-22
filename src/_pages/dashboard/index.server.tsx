import "server-only";

import { DashboardPage } from "./ui/dashboard-page";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { getCompanySettingsForAdministrator } from "@/shared/db/company-settings";
import type { DashboardActivityItem } from "./model/contracts";

type Props = Readonly<{
  activities: ReadonlyArray<DashboardActivityItem>;
  loadFailed: boolean;
}>;

export async function DashboardRoute({ activities, loadFailed }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const settings = await getCompanySettingsForAdministrator(administrator);
  return <DashboardPage administrator={administrator} settings={settings} activities={activities} loadFailed={loadFailed} />;
}
