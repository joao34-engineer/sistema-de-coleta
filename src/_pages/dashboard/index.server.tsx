import "server-only";

import { DashboardPage } from "./ui/dashboard-page";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { getCompanySettingsForAdministrator } from "@/shared/db/company-settings";

export async function DashboardRoute() {
  const administrator = await requireAuthenticatedAdministrator();
  const settings = await getCompanySettingsForAdministrator(administrator);
  return <DashboardPage administrator={administrator} settings={settings} />;
}
