import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { DraftSignaturePage } from "@/_pages/collection-drafts/ui/draft-signature-page";
import { fetchDraftWithItemsAction } from "@/_pages/collection-drafts/api/actions";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ColetaAssinaturaRoute({ params }: Props) {
  await requireAuthenticatedAdministrator();
  const resolvedParams = await params;
  const initial = await fetchDraftWithItemsAction(resolvedParams.id);

  return (
    <DraftSignaturePage
      draftId={resolvedParams.id}
      initialDraft={initial.draft}
      initialItems={initial.items}
    />
  );
}
