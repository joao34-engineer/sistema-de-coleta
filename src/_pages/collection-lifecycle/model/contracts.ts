import { z } from "zod";
import { isValidCnpj, normalizeDigits } from "@/shared/lib/cnpj";
import { collectionCursorSchema } from "./pagination";

const cursorSchema = collectionCursorSchema;

const uuidSchema = z.uuid();
export const collectionStatusSchema = z.enum([
  "draft",
  "collected",
  "canceled",
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "ready",
  "invoiced",
  "partial_delivery",
  "delivered",
  "rejected",
  "reopened",
]);
const evidenceMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

function normalizeCollectionEvidence(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return {
    ...record,
    mimeType: record["mimeType"] ?? record["contentType"],
    sizeBytes: record["sizeBytes"] ?? record["byteSize"],
  };
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (base: string, factor: number): number => {
    const sum = [...base].reduce((total, character, index) => total + Number(character) * (factor - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(value.slice(0, 9), 10) === Number(value[9]) && digit(value.slice(0, 10), 11) === Number(value[10]);
}

const taxIdSchema = z.string().trim().transform(normalizeDigits).refine((value) => isValidCpf(value) || isValidCnpj(value), "Informe um CPF ou CNPJ válido.");

export const collectionQuerySchema = z.object({
  code: z.string().trim().max(32).optional(),
  customer: z.string().trim().max(160).optional(),
  taxId: z.string().trim().transform(normalizeDigits).pipe(z.string().max(14)).optional(),
  phone: z.string().trim().transform(normalizeDigits).pipe(z.string().max(15)).optional(),
  status: collectionStatusSchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const collectionListItemSchema = z.object({
  id: uuidSchema,
  officialCode: z.string().nullable(),
  status: collectionStatusSchema,
  customerName: z.string().min(1).max(160).nullable(),
  customerTaxId: z.string().regex(/^\d{11}$|^\d{14}$/).nullable(),
  customerPhone: z.string().regex(/^\d{10,15}$/).nullable(),
  collectedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  rowVersion: z.number().int().positive(),
});

export const collectionListResultSchema = z.object({
  items: z.array(collectionListItemSchema),
  nextCursor: cursorSchema.nullable(),
});

export const collectionDetailSchema = z.object({
  id: uuidSchema,
  officialCode: z.string().nullable(),
  status: collectionStatusSchema,
  rowVersion: z.number().int().positive(),
  customer: z.object({ name: z.string().min(1).max(160), taxId: z.string().regex(/^\d{11}$|^\d{14}$/), phone: z.string().regex(/^\d{10,15}$/) }).nullable(),
  collectionLocation: z.object({ description: z.string().min(1).max(1000) }).nullable(),
  responsibleName: z.string().min(1).max(160).nullable(),
  collectedAt: z.iso.datetime({ offset: true }).nullable(),
  items: z.array(z.object({ id: uuidSchema, description: z.string().min(1).max(1000), quantity: z.number().positive(), condition: z.string().max(1000).nullable(), notes: z.string().max(2000).nullable() })),
  signature: z.object({ signerName: z.string().min(1).max(160), signerTaxId: z.string().regex(/^\d{11}$|^\d{14}$/), acceptedAt: z.iso.datetime({ offset: true }) }).nullable(),
  evidences: z.array(z.preprocess(normalizeCollectionEvidence, z.object({ id: uuidSchema, itemId: uuidSchema.nullable(), mimeType: evidenceMimeTypeSchema, sizeBytes: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional().default(null), createdAt: z.iso.datetime({ offset: true }) }))),
  currentDocument: z.object({ id: uuidSchema, version: z.number().int().positive(), status: z.enum(["snapshot_ready", "rendered", "failed"]), issuedAt: z.iso.datetime({ offset: true }) }).nullable(),
});

export const collectionEventSchema = z.object({
  id: uuidSchema,
  type: z.string().min(1).max(120),
  previousStatus: collectionStatusSchema.nullable(),
  nextStatus: collectionStatusSchema.nullable(),
  reason: z.string().max(1000).nullable(),
  actorName: z.string().max(160).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const collectionEventsResultSchema = z.object({ items: z.array(collectionEventSchema), nextCursor: cursorSchema.nullable() });

export const criticalCommandSchema = z.object({ expectedVersion: z.number().int().positive() });
export const reasonCommandSchema = criticalCommandSchema.extend({ reason: z.string().trim().min(3).max(1000) });

export const signatureInputSchema = z.object({
  signerName: z.string().trim().min(1, "Informe o nome do signatário.").max(160),
  signerTaxId: taxIdSchema,
  acceptanceText: z.string().trim().min(10, "Registre o texto de aceite.").max(2000),
  expectedVersion: z.coerce.number().int().positive(),
});

export const signatureCommandResultSchema = z.object({ collectionId: uuidSchema, rowVersion: z.number().int().positive(), signatureId: uuidSchema });
export const lifecycleCommandResultSchema = z.object({ collectionId: uuidSchema, officialCode: z.string().regex(/^MJT-\d{4}-\d{6}$/), status: collectionStatusSchema, rowVersion: z.number().int().positive(), document: z.object({ id: uuidSchema, version: z.number().int().positive(), status: z.literal("snapshot_ready") }) });

export type CollectionListQuery = z.output<typeof collectionQuerySchema>;
export type CollectionListItemDTO = z.output<typeof collectionListItemSchema>;
export type CollectionDetailDTO = z.output<typeof collectionDetailSchema>;
export type CollectionEventDTO = z.output<typeof collectionEventSchema>;
export type SignatureInput = z.output<typeof signatureInputSchema>;
