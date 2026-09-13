import type { CollectionStatus } from "./status";

export type CollectionDocumentStatus = "snapshot_ready" | "rendered" | "failed";

export type CollectionEvidenceMimeType = "image/png" | "image/jpeg" | "image/webp";

export type CollectionDetailCustomer = Readonly<{
  name: string;
  taxId: string;
  phone: string;
}>;

export type CollectionDetailLocation = Readonly<{
  description: string;
}>;

export type CollectionDetailItem = Readonly<{
  id: string;
  description: string;
  quantity: number;
  condition: string | null;
  notes: string | null;
}>;

export type CollectionDetailSignature = Readonly<{
  signerName: string;
  signerTaxId: string;
  acceptedAt: string;
}>;

export type CollectionDetailEvidence = Readonly<{
  id: string;
  itemId: string | null;
  mimeType: CollectionEvidenceMimeType;
  sizeBytes: number;
  sha256: string | null;
  createdAt: string;
}>;

export type CollectionDetailDocument = Readonly<{
  id: string;
  version: number;
  status: CollectionDocumentStatus;
  issuedAt: string;
}>;

/** DTO de detalhe compartilhado entre listagem/DAL de ciclo de vida, hub e oficina. */
export type CollectionDetailDTO = Readonly<{
  id: string;
  officialCode: string | null;
  status: CollectionStatus;
  rowVersion: number;
  customer: CollectionDetailCustomer | null;
  collectionLocation: CollectionDetailLocation | null;
  responsibleName: string | null;
  collectedAt: string | null;
  items: ReadonlyArray<CollectionDetailItem>;
  signature: CollectionDetailSignature | null;
  evidences: ReadonlyArray<CollectionDetailEvidence>;
  currentDocument: CollectionDetailDocument | null;
}>;
