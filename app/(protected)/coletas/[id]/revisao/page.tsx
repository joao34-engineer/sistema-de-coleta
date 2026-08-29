import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ColetaRevisaoRoute({ params }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const resolvedParams = await params;
  return (
    <CollectionCapturePage
      actor={{ userId: administrator.userId, organizationId: administrator.organizationId }}
      resumeDraftId={resolvedParams.id}
      initialStep="revisao"
    />
  );
}
