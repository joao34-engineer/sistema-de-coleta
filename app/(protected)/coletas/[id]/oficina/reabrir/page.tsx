import { loadCollectionForOperation } from "../../load-operation";
import { CancelReopenPage } from "@/_pages/collection-operations/ui/cancel-reopen-page";

export const dynamic = "force-dynamic";

export default async function ReopenCollectionRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const collection = await loadCollectionForOperation(id, "reabrir");

  return (
    <CancelReopenPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      allowedAction="reopen"
      rowVersion={collection.rowVersion}
    />
  );
}
