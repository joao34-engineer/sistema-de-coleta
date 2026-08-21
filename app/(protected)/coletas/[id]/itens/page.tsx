import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { DraftItemsPage } from "@/_pages/collection-drafts/ui/draft-items-page";
import { fetchDraftWithItemsAction } from "@/_pages/collection-drafts/api/actions";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ColetaItensRoute({ params }: Props) {
  await requireAuthenticatedAdministrator();
  const resolvedParams = await params;
  const initial = await fetchDraftWithItemsAction(resolvedParams.id);

  return (
    <DraftItemsPage
      draftId={resolvedParams.id}
      initialDraft={initial.draft}
      initialItems={initial.items}
    />
  );
}
