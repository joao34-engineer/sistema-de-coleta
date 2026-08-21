import { z } from "zod";

const uuidSchema = z.uuid();

/**
 * The worker does not claim a row by updating document_jobs.  The phase 2
 * claim RPC returns this small, camel-cased lease envelope instead.
 */
export const documentJobClaimSchema = z.object({
  jobId: uuidSchema,
  documentId: uuidSchema,
  jobType: z.enum(["render_pdf", "render_qr"]),
  attemptNumber: z.number().int().positive().max(20),
  leaseToken: uuidSchema,
  leaseExpiresAt: z.iso.datetime({ offset: true }),
}).strict();

export const documentJobCompletionSchema = z.object({
  jobId: uuidSchema,
  status: z.enum(["queued", "succeeded", "failed"]),
  attemptNumber: z.number().int().positive().max(20),
}).strict();

export const documentJobSchema = z.object({
  id: uuidSchema,
  document_id: uuidSchema,
  job_type: z.enum(["render_pdf", "render_qr"]),
  lease_token: uuidSchema,
  attempt_count: z.number().int().min(0).max(20),
  leased_until: z.iso.datetime({ offset: true }),
}).strict();

export const documentArtifactSchema = z.object({
  id: uuidSchema,
  organization_id: z.number().int().positive(),
  document_id: uuidSchema,
  artifact_type: z.enum(["pdf", "qr"]),
  storage_path: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
  content_type: z.enum(["application/pdf", "image/png"]),
  byte_size: z.number().int().min(1).max(52_428_800),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  created_by: uuidSchema,
  created_at: z.iso.datetime({ offset: true }),
}).strict();

export const documentRenderUploadIntentSchema = z.object({
  intentId: uuidSchema,
  storagePath: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
  bucket: z.literal("collection-documents"),
}).strict();

export const documentRenderUploadCommitSchema = z.object({
  intentId: uuidSchema,
  artifactId: uuidSchema,
  status: z.literal("committed"),
}).strict();

export const documentRenderUploadCancelSchema = z.object({
  intentId: uuidSchema,
  status: z.enum(["pending", "committed", "canceled", "expired"]),
  storagePath: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
}).strict();

export const documentRenderUploadCleanupAckSchema = z.object({
  intentId: uuidSchema,
  status: z.enum(["canceled", "expired"]),
  storagePath: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
  acknowledged: z.literal(true),
}).strict();

export const documentSourceSchema = z.object({
  id: uuidSchema,
  organization_id: z.number().int().positive(),
  snapshot: z.unknown(),
  verification_token: z.string().regex(/^[0-9a-f]{64}$/),
  issued_at: z.iso.datetime({ offset: true }),
  version: z.number().int().positive(),
}).strict();

export type DocumentJob = Readonly<z.output<typeof documentJobSchema>>;
export type DocumentArtifact = Readonly<z.output<typeof documentArtifactSchema>>;
export type DocumentSource = Readonly<z.output<typeof documentSourceSchema>>;
export type DocumentJobClaim = Readonly<z.output<typeof documentJobClaimSchema>>;
export type DocumentJobCompletion = Readonly<z.output<typeof documentJobCompletionSchema>>;
export type DocumentArtifactCommit = Readonly<z.output<typeof documentRenderUploadCommitSchema>>;
export type DocumentArtifactCancel = Readonly<z.output<typeof documentRenderUploadCancelSchema>>;
export type DocumentRenderUploadCleanupAck = Readonly<z.output<typeof documentRenderUploadCleanupAckSchema>>;

export type DocumentJobLease = Readonly<{
  job: DocumentJob;
  leaseExpiresAt: string;
}>;

export type ArtifactDraft = Readonly<{
  /** Null until commit_document_render_upload creates the append-only row. */
  artifactId: string | null;
  intentId: string | null;
  documentId: string;
  artifactType: "pdf" | "qr";
  contentType: "application/pdf" | "image/png";
  byteSize: number;
  sha256: string;
  storagePath: string;
}>;
