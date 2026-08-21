import { DocumentViewerPage } from "@/_pages/collection-documents/ui/document-viewer-page";

export const dynamic = "force-dynamic";

export default async function DocumentViewerRoute({
  params,
}: Readonly<{
  params: Promise<{ id: string; docId: string }>;
}>) {
  const { id, docId } = await params;
  return <DocumentViewerPage collectionId={id} documentId={docId} />;
}
