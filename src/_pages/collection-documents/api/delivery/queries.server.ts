import "server-only";

import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createPhaseTwoServiceClient } from "../rendering/server-client";
import { documentArtifactRowSchema, consumedShareSchema, inspectedShareSchema, type ConsumedShare, type DocumentListDTO, type InspectedShare } from "./contracts";
import { mapNestedDocumentList, type CollectionDocumentListResult } from "./document-list-map";
import { DocumentDeliveryError } from "./errors";

const documentListSelect = [
  "id,collection_id,version,status,issued_at",
  "document_artifacts(id,document_id,artifact_type,storage_path,content_type,byte_size,created_at)",
  "document_jobs(document_id,status,job_type)",
  "collections!documents_collection_id_organization_id_fkey(official_code)",
].join(",");

export async function listCollectionDocumentsWithMeta(
  collectionId: string,
): Promise<CollectionDocumentListResult> {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data: documentRows, error } = await supabase
    .from("documents")
    .select(documentListSelect)
    .eq("collection_id", collectionId)
    .order("version", { ascending: false });
  if (error) throw error;
  return mapNestedDocumentList(documentRows);
}

export async function listCollectionDocuments(collectionId: string): Promise<ReadonlyArray<DocumentListDTO>> {
  return (await listCollectionDocumentsWithMeta(collectionId)).documents;
}

export async function createDocumentArtifactDownload(documentId: string, artifactType: "pdf" | "qr"): Promise<string> {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("document_artifacts").select("id,document_id,artifact_type,storage_path,content_type,byte_size,created_at").eq("document_id", documentId).eq("artifact_type", artifactType).maybeSingle();
  if (error) throw error;
  if (data === null) throw new DocumentDeliveryError("artifact_not_found", 404, "Artefato não encontrado.");
  const artifact = documentArtifactRowSchema.parse(data);
  const service = createPhaseTwoServiceClient();
  const { data: signed, error: signedError } = await service.storage.from("collection-documents").createSignedUrl(artifact.storage_path, 300);
  if (signedError || !signed?.signedUrl) throw signedError ?? new Error("document_signed_url_missing");
  return signed.signedUrl;
}

export async function inspectDocumentShare(token: string): Promise<InspectedShare> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("inspect_document_share", { p_token: token });
  if (error) throw error;
  return inspectedShareSchema.parse(data);
}

export async function consumeDocumentShare(token: string): Promise<ConsumedShare> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("consume_document_share", { p_token: token });
  if (error) throw error;
  return consumedShareSchema.parse(data);
}

export async function createConsumedShareDownload(share: Extract<ConsumedShare, { valid: true }> | Extract<InspectedShare, { valid: true }>): Promise<string | null> {
  if (share.shareType !== "pdf") return null;
  const service = createPhaseTwoServiceClient();
  const { data, error } = await service.from("document_artifacts").select("id,document_id,artifact_type,storage_path,content_type,byte_size,created_at").eq("document_id", share.documentId).eq("artifact_type", "pdf").maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const artifact = documentArtifactRowSchema.parse(data);
  const { data: signed, error: signedError } = await service.storage.from("collection-documents").createSignedUrl(artifact.storage_path, 300);
  if (signedError || !signed?.signedUrl) return null;
  return signed.signedUrl;
}

