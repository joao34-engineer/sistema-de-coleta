import { z } from "zod";

const officialCodeSchema = z.string().regex(/^MJT-\d{4}-\d{6}$/);
const uuidSchema = z.uuid();
const taxIdSchema = z.string().regex(/^\d{11}$|^\d{14}$/);
const dateTimeSchema = z.iso.datetime({ offset: true });
const issuerTaxIdSchema = z.string().regex(/^\d{14}$/);
const logoStoragePathSchema = z.string().regex(/^\d+\/company-logo\/[0-9a-f-]{36}\.(png|jpg|webp)$/);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
export const frozenDocumentImageSchema = z.object({
  bytes: z.instanceof(Uint8Array).refine((value) => value.byteLength > 0 && value.byteLength <= 10 * 1024 * 1024),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sha256: sha256Schema,
}).strict();

/**
 * The issuer is part of the immutable document snapshot.  It is deliberately
 * not read from organization_settings while rendering: a later settings/logo
 * change must never rewrite an already issued document.
 */
const issuerSnapshotSchema = z.object({
  id: uuidSchema,
  legal_name: z.string().trim().min(1).max(160),
  tax_id: issuerTaxIdSchema,
  phone: z.string().trim().min(10).max(30),
  street: z.string().trim().min(1).max(160),
  street_number: z.string().trim().min(1).max(20),
  address_complement: z.string().trim().max(120).nullable(),
  district: z.string().trim().max(100).nullable(),
  city: z.string().trim().min(1).max(100),
  state_code: z.string().regex(/^[A-Z]{2}$/),
  postal_code: z.string().regex(/^\d{8}$/),
  receipt_legal_text: z.string().trim().min(1).max(2000),
  signer_name: z.string().trim().min(1).max(160),
  signer_title: z.string().trim().min(1).max(120),
  logo_asset_id: uuidSchema,
  logo_storage_path: logoStoragePathSchema,
  logo_sha256: sha256Schema,
}).strict();

export const collectionDocumentSnapshotSchema = z.object({
  collection: z.object({
    id: uuidSchema,
    official_code: officialCodeSchema,
    status: z.enum(["collected", "canceled"]),
    location: z.string().trim().min(1).max(1000),
    responsible_name: z.string().trim().min(1).max(160),
    responsible_tax_id: taxIdSchema,
    collected_at: dateTimeSchema,
    issued_year: z.number().int().min(2000).max(9999),
    sequence_number: z.number().int().positive(),
    row_version: z.number().int().positive(),
  }).strict(),
  customer: z.object({
    id: uuidSchema,
    legal_name: z.string().trim().min(1).max(160),
    tax_id: taxIdSchema,
    phone: z.string().regex(/^\d{10,15}$/),
  }).strict(),
  items: z.array(z.object({
    id: uuidSchema,
    description: z.string().trim().min(1).max(1000),
    quantity: z.number().positive(),
    condition_note: z.string().max(1000).nullable(),
    observation: z.string().max(2000).nullable(),
    position: z.number().int().nonnegative(),
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
  }).strict()).min(1),
  evidences: z.array(z.object({
    id: uuidSchema,
    item_id: uuidSchema.nullable(),
    storage_path: z.string().min(1).max(512),
    content_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
    byte_size: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    created_at: dateTimeSchema,
  }).strict()),
  signature: z.object({
    id: uuidSchema,
    signer_name: z.string().trim().min(1).max(160),
    signer_tax_id: taxIdSchema,
    acceptance_text: z.string().trim().min(1).max(2000),
    storage_path: z.string().min(1).max(512),
    byte_size: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    signed_at: dateTimeSchema,
  }).strict().nullable(),
  organization: z.object({
    id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
    display_name: z.string().trim().min(1).max(160),
  }).strict(),
  issuer: issuerSnapshotSchema,
}).strict();

export const documentRenderInputSchema = z.object({
  snapshot: collectionDocumentSnapshotSchema,
  documentVersion: z.number().int().positive(),
  verificationToken: z.string().regex(/^[0-9a-f]{64}$/),
  verificationBaseUrl: z.url().refine((value) => {
    const url = new URL(value);
    const isLocalDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return (url.protocol === "https:" || (url.protocol === "http:" && isLocalDevelopment)) && !url.username && !url.password;
  }, "A URL de verificação deve usar HTTPS e não pode conter credenciais."),
  issuedAt: dateTimeSchema.optional(),
  /** Binary assets are loaded server-side from frozen paths, never a current setting or public URL. */
  frozenAssets: z.object({
    logo: frozenDocumentImageSchema.optional(),
    signature: frozenDocumentImageSchema.optional(),
  }).strict().optional(),
}).strict();

export type CollectionDocumentSnapshot = Readonly<z.output<typeof collectionDocumentSnapshotSchema>>;
export type DocumentRenderInput = Readonly<z.output<typeof documentRenderInputSchema>>;
export type FrozenDocumentImage = Readonly<z.output<typeof frozenDocumentImageSchema>>;
export type FrozenDocumentAssets = Readonly<NonNullable<z.output<typeof documentRenderInputSchema>["frozenAssets"]>>;

export type RenderedDocument = Readonly<{
  documentVersion: number;
  snapshot: CollectionDocumentSnapshot;
  canonicalSnapshot: string;
  snapshotHash: string;
  verificationUrl: string;
  qrPayload: string;
  pdfBytes: Uint8Array;
  pdfSha256: string;
  contentType: "application/pdf";
  filename: string;
}>;
