import "server-only";

import { createElement } from "react";
import { listCollectionDocuments } from "./api/delivery/queries.server";
import { getCollectionOfficialCode } from "./api/delivery/collection-code.server";
import { verifyCollectionDocument } from "./api/public/verification";
import { CollectionDocumentsPage } from "./ui/collection-documents-page";
import { DocumentViewerPage } from "./ui/document-viewer-page";
import { PublicVerificationPage } from "./ui/public-verification-page";

export * from "./api/delivery/index.server";
export { isValidVerificationToken } from "./api/public/dto";
export { verifyCollectionDocument } from "./api/public/verification";
export { cleanupExpiredDocumentRenderIntents } from "./api/rendering/cleanup.server";
export { scheduleDocumentRenderKick } from "./api/schedule-document-render-kick";
export { PublicVerificationPage } from "./ui/public-verification-page";
export { PublicVerificationWaitPage } from "./ui/public-verification-wait-page";

export async function PublicVerificationRoute({ token }: Readonly<{ token: string }>) {
  try {
    const verification = await verifyCollectionDocument(token);
    return createElement(PublicVerificationPage, { verification });
  } catch {
    return createElement(PublicVerificationPage, { verification: null });
  }
}

export async function CollectionDocumentsRoute({ collectionId }: Readonly<{ collectionId: string }>) {
  const [documents, officialCode] = await Promise.all([
    listCollectionDocuments(collectionId),
    getCollectionOfficialCode(collectionId),
  ]);
  return createElement(CollectionDocumentsPage, { collectionId, documents, officialCode });
}

export async function CollectionDocumentViewerRoute({
  collectionId,
  documentId,
}: Readonly<{ collectionId: string; documentId: string }>) {
  const documents = await listCollectionDocuments(collectionId);
  const document = documents.find((item) => item.id === documentId);
  const hasPdf = document?.artifacts.some((artifact) => artifact.type === "pdf") ?? false;
  return createElement(DocumentViewerPage, {
    collectionId,
    documentId,
    hasPdf,
    ...(document?.pdfJobStatus === undefined ? {} : { pdfJobStatus: document.pdfJobStatus }),
  });
}
