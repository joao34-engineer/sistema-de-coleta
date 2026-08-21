import "server-only";

import { createElement } from "react";
import { verifyCollectionDocument } from "./api/public/verification";
import { PublicVerificationPage } from "./ui/public-verification-page";
import { listCollectionDocuments } from "./api/delivery/queries.server";
import { CollectionDocumentsPage } from "./ui/collection-documents-page";

export { verifyCollectionDocument } from "./api/public/verification";

export async function PublicVerificationRoute({ token }: Readonly<{ token: string }>) {
  const verification = await verifyCollectionDocument(token);
  return createElement(PublicVerificationPage, { verification });
}

export async function CollectionDocumentsRoute({ collectionId }: Readonly<{ collectionId: string }>) {
  const documents = await listCollectionDocuments(collectionId);
  return createElement(CollectionDocumentsPage, { collectionId, documents });
}
