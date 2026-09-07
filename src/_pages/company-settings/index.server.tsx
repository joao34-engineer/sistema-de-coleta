import "server-only";

import { CompanySettingsPage } from "./ui/company-settings-page";
import { companySettingsBackHref } from "./model/company-settings-back-href";
import { getCompanySettings } from "@/shared/db/company-settings";

export async function CompanySettingsRoute(input: Readonly<{ from?: string | undefined }> = {}) {
  const settings = await getCompanySettings();
  return <CompanySettingsPage settings={settings} backHref={companySettingsBackHref(input.from)} />;
}
