import { z } from "zod";

export const collectionIdSchema = z.string().uuid();
export const draftCreateSchema = z.object({ id: collectionIdSchema, customerId: z.string().uuid().optional() });
export const draftPatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  customerId: z.string().uuid().nullable().optional(),
  collectionLocation: z.string().trim().max(1000).nullable().optional(),
  responsibleName: z.string().trim().min(1).max(160).nullable().optional(),
  responsibleTaxId: z.string().regex(/^\d{11}$|^\d{14}$/).nullable().optional(),
  collectedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), "Informe ao menos um campo para salvar.");
export const itemCreateSchema = z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().positive().max(1_000_000), condition: z.string().trim().max(500).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional() });
export const itemPatchSchema = itemCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para alterar.");
export const itemCreateCommandSchema = itemCreateSchema.extend({ expectedVersion: z.number().int().positive() });
export const itemPatchCommandSchema = itemPatchSchema.extend({ expectedVersion: z.number().int().positive() });
export const itemIdSchema = z.string().uuid();
export const expectedVersionSchema = z.object({ expectedVersion: z.number().int().positive() });

export type DraftDTO = Readonly<{ id: string; customerId: string | null; status: "draft"; collectionLocation: string | null; responsibleName: string | null; responsibleTaxId: string | null; collectedAt: string | null; rowVersion: number; createdAt: string; updatedAt: string }>;
export type DraftItemDTO = Readonly<{ id: string; description: string; quantity: number; condition: string | null; notes: string | null; createdAt: string; updatedAt: string }>;
export type EvidenceDTO = Readonly<{ id: string; itemId: string | null; mimeType: "image/png" | "image/jpeg" | "image/webp"; sizeBytes: number; sha256: string; createdAt: string }>;
