import { z } from "zod";

const uuidSchema = z.uuid();
const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const documentListRowSchema = z.object({
  id: uuidSchema,
  collection_id: uuidSchema,
  version: z.number().int().positive(),
  status: z.string().min(1).max(80),
  issued_at: z.iso.datetime({ offset: true }),
}).strict();

export const documentArtifactRowSchema = z.object({
  id: uuidSchema,
  document_id: uuidSchema,
  artifact_type: z.enum(["pdf", "qr"]),
  storage_path: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
  content_type: z.enum(["application/pdf", "image/png"]),
  byte_size: z.number().int().positive().max(52_428_800),
  created_at: z.iso.datetime({ offset: true }),
}).strict();

export const documentShareCreatedSchema = z.object({
  shareId: uuidSchema,
  token: tokenSchema,
  shareType: z.enum(["pdf", "verification"]),
  expiresAt: z.iso.datetime({ offset: true }),
  maxDownloads: z.number().int().min(1).max(20),
  downloadCount: z.number().int().min(0).max(20),
}).strict();

export const inspectedShareSchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(false), code: z.string().min(1).max(80) }).strict(),
  z.object({
    valid: z.literal(true),
    shareId: uuidSchema,
    shareType: z.enum(["pdf", "verification"]),
    documentId: uuidSchema,
    organizationId: z.number().int().positive(),
    collectionId: uuidSchema,
    documentVersion: z.number().int().positive(),
    issuedAt: z.iso.datetime({ offset: true }),
    maxDownloads: z.number().int().min(1).max(20),
    downloadCount: z.number().int().min(0).max(20),
  }).strict(),
]);

export const consumedShareSchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(false), code: z.string().min(1).max(80) }).strict(),
  z.object({
    valid: z.literal(true),
    shareId: uuidSchema,
    shareType: z.enum(["pdf", "verification"]),
    documentId: uuidSchema,
    organizationId: z.number().int().positive(),
    collectionId: uuidSchema,
    documentVersion: z.number().int().positive(),
    issuedAt: z.iso.datetime({ offset: true }),
    maxDownloads: z.number().int().min(1).max(20),
    downloadCount: z.number().int().min(1).max(20),
  }).strict(),
]);

export const documentJobStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);

export const documentJobRowSchema = z.object({
  document_id: uuidSchema,
  status: documentJobStatusSchema,
}).strict();

export type DocumentJobStatus = z.output<typeof documentJobStatusSchema>;

export type DocumentListDTO = Readonly<{
  id: string;
  collectionId: string;
  version: number;
  status: string;
  issuedAt: string;
  pdfJobStatus?: DocumentJobStatus;
  artifacts: ReadonlyArray<Readonly<{
    id: string;
    type: "pdf" | "qr";
    contentType: "application/pdf" | "image/png";
    byteSize: number;
    createdAt: string;
  }>>;
}>;

export type InspectedShare = z.output<typeof inspectedShareSchema>;
export type ConsumedShare = z.output<typeof consumedShareSchema>;

/** Public callers cannot shorten/extend a recipient link or raise its quota. */
export const shareCreateSchema = z.object({
  shareType: z.enum(["pdf", "verification"]).default("pdf"),
  expiresAt: z.null().optional(),
  maxDownloads: z.literal(20).optional(),
}).strict().transform((value) => ({ shareType: value.shareType }));

export const emailShareSchema = z.object({
  email: z.email().max(254),
  // The raw token exists only at the hand-off between share creation and the
  // provider. It is never written to Supabase or returned from this endpoint.
  shareToken: tokenSchema,
}).strict();

const customerDocumentPatchSchema = z.object({
  legal_name: z.string().trim().min(1).max(160).optional(),
  tax_id: z.string().trim().min(1).max(20).optional(),
  phone: z.string().regex(/^\d{10,15}$/).optional(),
}).strict();

const collectionDocumentPatchSchema = z.object({
  location: z.string().trim().min(1).max(1000).optional(),
  responsible_name: z.string().trim().min(1).max(160).optional(),
  responsible_tax_id: z.string().trim().min(1).max(20).optional(),
  collected_at: z.iso.datetime({ offset: true }).optional(),
}).strict();

const itemDocumentPatchSchema = z.object({
  id: uuidSchema,
  description: z.string().trim().min(1).max(1000).optional(),
  quantity: z.number().positive().optional(),
  condition_note: z.string().max(1000).nullable().optional(),
  observation: z.string().max(2000).nullable().optional(),
}).strict().refine((item) => item.description !== undefined || item.quantity !== undefined || item.condition_note !== undefined || item.observation !== undefined, { message: "Informe ao menos um campo do item." });

export const typedDocumentPatchSchema = z.object({
  customer: customerDocumentPatchSchema.optional(),
  collection: collectionDocumentPatchSchema.optional(),
  items: z.array(itemDocumentPatchSchema).min(1).optional(),
}).strict().refine((patch) => patch.customer !== undefined || patch.collection !== undefined || patch.items !== undefined, { message: "Informe ao menos uma alteração documental." });

export const revisionSchema = z.object({
  sourceDocumentId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  typedDocumentPatch: typedDocumentPatchSchema,
  revisionType: z.enum(["correction", "reissue", "reopen"]),
  reason: z.string().trim().min(1).max(2000),
}).strict();

export const documentRevisionResultSchema = z.object({
  revisionId: uuidSchema,
  previousDocumentId: uuidSchema,
  replacementDocumentId: uuidSchema,
  jobId: uuidSchema,
  document: z.object({ id: uuidSchema, version: z.number().int().positive(), status: z.string().min(1).max(80) }).strict(),
}).strict();

export type ShareCreateInput = z.output<typeof shareCreateSchema>;
export type EmailShareInput = z.output<typeof emailShareSchema>;
export type RevisionInput = z.output<typeof revisionSchema>;
