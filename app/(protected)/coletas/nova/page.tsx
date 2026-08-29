import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";

type Props = Readonly<{
  searchParams: Promise<{ rascunho?: string }>;
}>;

export default async function NovaColetaRoute({ searchParams }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const params = await searchParams;
  return (
    <CollectionCapturePage
      actor={{ userId: administrator.userId, organizationId: administrator.organizationId }}
      {...(params.rascunho === undefined ? {} : { resumeDraftId: params.rascunho })}
    />
  );
}
