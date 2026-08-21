import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { CollectorProfilePage } from "@/_pages/company-settings/ui/collector-profile-page";

export const dynamic = "force-dynamic";

export default async function SettingsRoute() {
  const admin = await requireAuthenticatedAdministrator();
  return <CollectorProfilePage administrator={admin} />;
}
