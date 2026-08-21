import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { NewCollectionPage } from "@/_pages/collection-drafts/ui/new-collection-page";

export default async function NovaColetaRoute() {
  await requireAuthenticatedAdministrator();
  return <NewCollectionPage />;
}
