import "server-only";

import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createPhaseTwoServiceClient } from "../rendering/server-client";
import { documentArtifactRowSchema, documentJobRowSchema, documentListRowSchema, consumedShareSchema, inspectedShareSchema, type ConsumedShare, type DocumentListDTO, type InspectedShare } from "./contracts";
import { DocumentDeliveryError } from "./errors";

export async function listCollectionDocuments(collectionId: string): Promise<ReadonlyArray<DocumentListDTO>> {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data: documentRows, error } = await supabase.from("documents").select("id,collection_id,version,status,issued_at").eq("collection_id", collectionId).order("version", { ascending: false });
  if (error) throw error;
  const documents = (documentRows ?? []).map((row) => documentListRowSchema.parse(row));
  if (documents.length === 0) return [];

  const documentIds = documents.map((document) => document.id);
  const [{ data: artifactRows, error: artifactsError }, { data: jobRows, error: jobsError }] = await Promise.all([
    supabase.from("document_artifacts").select("id,document_id,artifact_type,storage_path,content_type,byte_size,created_at").in("document_id", documentIds),
    supabase.from("document_jobs").select("document_id,status").in("document_id", documentIds).eq("job_type", "render_pdf"),
  ]);
  if (artifactsError) throw artifactsError;
  if (jobsError) throw jobsError;
  const artifacts = (artifactRows ?? []).map((row) => documentArtifactRowSchema.parse(row));
  const pdfJobs = (jobRows ?? []).map((row) => documentJobRowSchema.parse(row));
  return documents.map((document) => {
    const pdfJob = pdfJobs.find((job) => job.document_id === document.id);
    return {
      id: document.id,
      collectionId: document.collection_id,
      version: document.version,
      status: document.status,
      issuedAt: document.issued_at,
      ...(pdfJob ? { pdfJobStatus: pdfJob.status } : {}),
      artifacts: artifacts.filter((artifact) => artifact.document_id === document.id).map((artifact) => ({ id: artifact.id, type: artifact.artifact_type, contentType: artifact.content_type, byteSize: artifact.byte_size, createdAt: artifact.created_at })),
    };
  });
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

