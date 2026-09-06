import "server-only";

import { DashboardPage } from "./ui/dashboard-page";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { getCompanySettingsForAdministrator } from "@/shared/db/company-settings";
import type { DashboardActivityItem } from "./model/contracts";

type Props = Readonly<{
  activities: ReadonlyArray<DashboardActivityItem>;
  inProgressCount: number;
  readyForDeliveryCount: number;
  loadFailed: boolean;
}>;

function formatTodayLabel(): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function DashboardRoute({ activities, inProgressCount, readyForDeliveryCount, loadFailed }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const settings = await getCompanySettingsForAdministrator(administrator);
  return (
    <DashboardPage
      administrator={administrator}
      settings={settings}
      activities={activities}
      inProgressCount={inProgressCount}
      readyForDeliveryCount={readyForDeliveryCount}
      loadFailed={loadFailed}
      todayLabel={formatTodayLabel()}
    />
  );
}
