import { CollectionDocumentViewerRoute } from "@/_pages/collection-documents/index.server";

export const dynamic = "force-dynamic";

export default async function DocumentViewerRoute({
  params,
}: Readonly<{
  params: Promise<{ id: string; docId: string }>;
}>) {
  const { id, docId } = await params;
  return <CollectionDocumentViewerRoute collectionId={id} documentId={docId} />;
}
