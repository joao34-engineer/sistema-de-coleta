import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { DraftReviewPage } from "@/_pages/collection-drafts/ui/draft-review-page";
import { fetchDraftWithItemsAction } from "@/_pages/collection-drafts/api/actions";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ColetaRevisaoRoute({ params }: Props) {
  await requireAuthenticatedAdministrator();
  const resolvedParams = await params;
  const initial = await fetchDraftWithItemsAction(resolvedParams.id);

  return (
    <DraftReviewPage
      draftId={resolvedParams.id}
      initialDraft={initial.draft}
      initialItems={initial.items}
    />
  );
}
