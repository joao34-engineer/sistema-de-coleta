import "server-only";

import {
  collectionDocumentSnapshotSchema,
  frozenDocumentImageSchema,
  type FrozenDocumentAssets,
  type FrozenDocumentImage,
} from "./contracts";
import {
  documentArtifactSchema,
  documentJobClaimSchema,
  documentJobCompletionSchema,
  documentJobSchema,
  documentRenderUploadCancelSchema,
  documentRenderUploadCommitSchema,
  documentRenderUploadIntentSchema,
  documentSourceSchema,
  type ArtifactDraft,
  type DocumentArtifactCancel,
  type DocumentArtifactCommit,
  type DocumentJob,
  type DocumentJobCompletion,
  type DocumentJobLease,
  type DocumentSource,
} from "./generation-contracts";
import { createPhaseTwoServiceClient, type PhaseTwoSupabaseClient } from "./server-client";
import { sha256Hex } from "./canonical-json";

const DEFAULT_DOCUMENT_WORKER_ID = "sistema-coleta-document-worker";
const MAX_ARTIFACT_BYTES = 52_428_800;

export type DocumentJobQueue = Readonly<{
  claimNext(workerId?: string): Promise<DocumentJobLease | null>;
  getDocument(documentId: string): Promise<DocumentSource>;
  getFrozenAssets(source: DocumentSource): Promise<FrozenDocumentAssets>;
  succeed(job: DocumentJob, artifactId: string): Promise<DocumentJobCompletion>;
  fail(job: DocumentJob, errorCode: string, errorMessage: string): Promise<DocumentJobCompletion>;
}>;

function parseJobClaim(value: unknown): DocumentJobLease {
  const claim = documentJobClaimSchema.parse(value);
  const job = documentJobSchema.parse({
    id: claim.jobId,
    document_id: claim.documentId,
    job_type: claim.jobType,
    lease_token: claim.leaseToken,
    attempt_count: claim.attemptNumber,
    leased_until: claim.leaseExpiresAt,
  });
  return { job, leaseExpiresAt: claim.leaseExpiresAt };
}

function parseSource(value: unknown): DocumentSource {
  return documentSourceSchema.parse(value);
}

async function downloadFrozenImage(
  client: PhaseTwoSupabaseClient,
  bucket: "organization-assets" | "collection-signatures",
  storagePath: string,
  expectedSha256: string,
): Promise<FrozenDocumentImage> {
  const { data, error } = await client.storage.from(bucket).download(storagePath);
  if (error || data === null) throw new Error("frozen_document_asset_unavailable");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const contentType = data.type;
  const actualSha256 = sha256Hex(bytes);
  if (actualSha256 !== expectedSha256) throw new Error("frozen_document_asset_integrity_mismatch");
  return frozenDocumentImageSchema.parse({ bytes, contentType, sha256: actualSha256 });
}

function workerIdFromEnvironment(workerId?: string): string {
  const configured = workerId ?? process.env["DOCUMENT_WORKER_ID"] ?? DEFAULT_DOCUMENT_WORKER_ID;
  const trimmed = configured.trim();
  if (trimmed.length < 1 || trimmed.length > 120) throw new Error("document_worker_id_invalid");
  return trimmed;
}

async function completeJob(
  client: PhaseTwoSupabaseClient,
  job: DocumentJob,
  status: "succeeded" | "failed",
  artifactId: string | null,
  errorCode: string | null,
  errorMessage: string | null,
): Promise<DocumentJobCompletion> {
  const { data, error } = await client.rpc("complete_document_job", {
    p_job_id: job.id,
    p_lease_token: job.lease_token,
    p_status: status,
    p_artifact_id: artifactId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
  if (error) throw error;
  return documentJobCompletionSchema.parse(data);
}

export function createDocumentJobQueue(
  client: PhaseTwoSupabaseClient = createPhaseTwoServiceClient(),
  defaultWorkerId?: string,
  documentId?: string,
): DocumentJobQueue {
  return {
    async claimNext(workerId) {
      const worker = workerIdFromEnvironment(workerId ?? defaultWorkerId);
      const { data, error } = documentId === undefined
        ? await client.rpc("claim_document_job", {
          p_worker_id: worker,
          p_lease_seconds: 300,
        })
        : await client.rpc("claim_document_job_for_document", {
          p_worker_id: worker,
          p_lease_seconds: 300,
          p_document_id: documentId,
        });
      if (error) throw error;
      return data === null ? null : parseJobClaim(data);
    },
    async getDocument(documentId) {
      const { data, error } = await client.from("documents").select("id,organization_id,snapshot,verification_token,issued_at,version").eq("id", documentId).maybeSingle();
      if (error) throw error;
      if (data === null) throw new Error("document_source_not_found");
      return parseSource(data);
    },
    async getFrozenAssets(source) {
      const snapshot = collectionDocumentSnapshotSchema.parse(source.snapshot);
      const logo = await downloadFrozenImage(
        client,
        "organization-assets",
        snapshot.issuer.logo_storage_path,
        snapshot.issuer.logo_sha256,
      );
      const signature = snapshot.signature === null
        ? undefined
        : await downloadFrozenImage(client, "collection-signatures", snapshot.signature.storage_path, snapshot.signature.sha256);
      return signature ? { logo, signature } : { logo };
    },
    async succeed(job, artifactId) {
      return completeJob(client, job, "succeeded", artifactId, null, null);
    },
    async fail(job, errorCode, errorMessage) {
      const code = errorCode.trim().slice(0, 120) || "render_failed";
      const message = errorMessage.trim().slice(0, 2000) || "Falha na renderização do documento.";
      return completeJob(client, job, "failed", null, code, message);
    },
  };
}

export type DocumentArtifactRepository = Readonly<{
  /**
   * Existing artifacts are returned as-is for idempotent job retries. New
   * artifacts receive a private upload intent; the public row is only created
   * by commit_document_render_upload after Storage confirms the object.
   */
  prepare(job: DocumentJob, artifactType: "pdf" | "qr", byteSize: number, sha256: string): Promise<ArtifactDraft>;
  commit(draft: ArtifactDraft): Promise<DocumentArtifactCommit>;
  cancel(draft: ArtifactDraft): Promise<DocumentArtifactCancel | null>;
}>;

function contentTypeFor(artifactType: "pdf" | "qr"): "application/pdf" | "image/png" {
  return artifactType === "pdf" ? "application/pdf" : "image/png";
}

function assertArtifactMetadata(byteSize: number, sha256: string): void {
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_ARTIFACT_BYTES) throw new Error("artifact_metadata_invalid");
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("artifact_metadata_invalid");
}

export function createDocumentArtifactRepository(client: PhaseTwoSupabaseClient = createPhaseTwoServiceClient()): DocumentArtifactRepository {
  return {
    async prepare(job, artifactType, byteSize, sha256) {
      assertArtifactMetadata(byteSize, sha256);
      const contentType = contentTypeFor(artifactType);
      const { data: existing, error: lookupError } = await client
        .from("document_artifacts")
        .select("id,organization_id,document_id,artifact_type,storage_path,content_type,byte_size,sha256,created_by,created_at")
        .eq("document_id", job.document_id)
        .eq("artifact_type", artifactType)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing !== null) {
        const artifact = documentArtifactSchema.parse(existing);
        return {
          artifactId: artifact.id,
          intentId: null,
          documentId: artifact.document_id,
          artifactType: artifact.artifact_type,
          contentType: artifact.content_type,
          byteSize: artifact.byte_size,
          sha256: artifact.sha256,
          storagePath: artifact.storage_path,
        };
      }

      const { data, error } = await client.rpc("prepare_document_render_upload", {
        p_job_id: job.id,
        p_lease_token: job.lease_token,
        p_artifact_type: artifactType,
        p_content_type: contentType,
        p_byte_size: byteSize,
        p_sha256: sha256,
      });
      if (error) throw error;
      const intent = documentRenderUploadIntentSchema.parse(data);
      return {
        artifactId: null,
        intentId: intent.intentId,
        documentId: job.document_id,
        artifactType,
        contentType,
        byteSize,
        sha256,
        storagePath: intent.storagePath,
      };
    },
    async commit(draft) {
      if (draft.artifactId !== null) throw new Error("document_artifact_already_committed");
      if (draft.intentId === null) throw new Error("document_upload_intent_missing");
      const { data, error } = await client.rpc("commit_document_render_upload", { p_intent_id: draft.intentId });
      if (error) throw error;
      return documentRenderUploadCommitSchema.parse(data);
    },
    async cancel(draft) {
      if (draft.intentId === null) return null;
      const { data, error } = await client.rpc("cancel_document_render_upload", { p_intent_id: draft.intentId });
      if (error) throw error;
      return documentRenderUploadCancelSchema.parse(data);
    },
  };
}
