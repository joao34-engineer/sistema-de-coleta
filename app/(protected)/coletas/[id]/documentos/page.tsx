import { CollectionDocumentsRoute } from "@/_pages/collection-documents/index.server";

export const dynamic = "force-dynamic";

export default async function CollectionDocumentsPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return CollectionDocumentsRoute({ collectionId: id });
}
