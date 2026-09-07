import { CompanySettingsRoute } from "@/_pages/company-settings/index.server";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPageRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<{ from?: string | string[] }> }>) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  return CompanySettingsRoute({ from });
}
