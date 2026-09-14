import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { loadWizardDraftForPage, wizardDraftFromLoad } from "@/_app/load-wizard-draft.server";
import { CollectionCapturePage } from "@/_pages/collection-drafts";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ColetaItensRoute({ params }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const resolvedParams = await params;
  const initialDraft = wizardDraftFromLoad(await loadWizardDraftForPage(resolvedParams.id));
  return (
    <CollectionCapturePage
      actor={{ userId: administrator.userId, organizationId: administrator.organizationId }}
      resumeDraftId={resolvedParams.id}
      initialStep="itens"
      {...(initialDraft === undefined ? {} : { initialDraft })}
    />
  );
}
