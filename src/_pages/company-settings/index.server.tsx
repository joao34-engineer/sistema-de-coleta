import "server-only";

import { CompanySettingsPage } from "./ui/company-settings-page";
import { getCompanySettings } from "@/shared/db/company-settings";

export async function CompanySettingsRoute() {
  const settings = await getCompanySettings();
  return <CompanySettingsPage settings={settings} />;
}
