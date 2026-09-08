import { z } from "zod";
import { cpfOrCnpjSchema, optionalCpfOrCnpjSchema } from "@/shared/lib/cpf";
import { captureSteps } from "./capture-actor";

export const OFFLINE_DATABASE_NAME = "mjt-offline-v1";
export const OFFLINE_DATABASE_VERSION = 1;
export const OFFLINE_DRAFTS_STORE = "drafts";
export const OFFLINE_ITEMS_STORE = "items";
export const OFFLINE_BLOBS_STORE = "blobs";
export const OFFLINE_MUTATIONS_STORE = "mutations";

export const captureStepSchema = z.enum(captureSteps);
export const mutationKindSchema = z.enum([
  "create_customer",
  "create_draft",
  "patch_draft",
  "add_item",
  "patch_item",
  "remove_item",
  "save_signature",
  "finalize",
  "discard_draft",
]);
export const mutationStatusSchema = z.enum(["pending", "in_flight", "done", "failed"]);
export const draftSyncStatusSchema = z.enum(["local", "queued", "syncing", "synced", "failed"]);

const cadastralFields = {
  street: z.string().max(160).nullable(),
  city: z.string().max(100).nullable().optional(),
  stateCode: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
};

const newCustomerSchema = z.object({
  mode: z.literal("new"),
  displayName: z.string().min(1).max(160),
  taxId: z.string().regex(/^\d{11}$|^\d{14}$/),
  phone: z.string().min(8).max(20),
  ...cadastralFields,
});

const existingCustomerSchema = z.object({
  mode: z.literal("existing"),
  customerId: z.string().uuid(),
  displayName: z.string().min(1).max(160),
  taxId: z.string().regex(/^\d{11}$|^\d{14}$/),
  phone: z.string().min(8).max(20),
  ...cadastralFields,
});

export const offlineCustomerSchema = z.discriminatedUnion("mode", [newCustomerSchema, existingCustomerSchema]);

export const offlineDraftRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.number().int().positive(),
  currentStep: captureStepSchema,
  customer: offlineCustomerSchema,
  collectionLocation: z.string().max(1000).nullable(),
  responsibleName: z.string().max(160).nullable(),
  responsibleTaxId: z.string().regex(/^\d{11}$|^\d{14}$/).nullable(),
  collectedAt: z.string().nullable(),
  serverRowVersion: z.number().int().positive().nullable(),
  serverCustomerId: z.string().uuid().nullable(),
  hasServerSignature: z.boolean(),
  finalizeIdempotencyKey: z.string().uuid().nullable(),
  syncStatus: draftSyncStatusSchema,
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const offlineItemRecordSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  userId: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(1_000_000),
  condition: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(),
  removed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const offlineBlobRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.literal("signature"),
  dataUrl: z.string().min(1),
});

export const createCustomerPayloadSchema = z.object({
  displayName: z.string().min(1),
  taxId: z.string().regex(/^\d{11}$|^\d{14}$/),
  phone: z.string().min(8),
  street: z.string().max(160).nullable(),
  city: z.string().max(100).nullable().optional(),
  stateCode: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
});

export const discardDraftPayloadSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
});

export const createDraftPayloadSchema = z.object({
  draftId: z.string().uuid(),
});

export const patchDraftPayloadSchema = z.object({
  collectionLocation: z.string().max(1000).nullable().optional(),
  responsibleName: z.string().max(160).nullable().optional(),
  responsibleTaxId: optionalCpfOrCnpjSchema,
  collectedAt: z.string().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});

export const itemPayloadSchema = z.object({
  itemId: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().positive().optional(),
  condition: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const saveSignaturePayloadSchema = z.object({
  signerName: z.string().min(1).max(160),
  signerTaxId: cpfOrCnpjSchema,
  acceptanceText: z.string().min(10).max(2000),
});

export const finalizePayloadSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export const offlineMutationRecordSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  userId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  kind: mutationKindSchema,
  payload: z.unknown(),
  status: mutationStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
});

export type OfflineCustomer = z.output<typeof offlineCustomerSchema>;
export type OfflineDraftRecord = z.output<typeof offlineDraftRecordSchema>;
export type OfflineItemRecord = z.output<typeof offlineItemRecordSchema>;
export type OfflineBlobRecord = z.output<typeof offlineBlobRecordSchema>;
export type OfflineMutationRecord = z.output<typeof offlineMutationRecordSchema>;
export type MutationKind = z.output<typeof mutationKindSchema>;

export const offlineDatabaseSchema = {
  name: OFFLINE_DATABASE_NAME,
  version: OFFLINE_DATABASE_VERSION,
  stores: [
    {
      name: OFFLINE_DRAFTS_STORE,
      keyPath: "id",
      indexes: [{ name: "userId", keyPath: "userId" }],
    },
    {
      name: OFFLINE_ITEMS_STORE,
      keyPath: "id",
      indexes: [{ name: "collectionId", keyPath: "collectionId" }],
    },
    {
      name: OFFLINE_BLOBS_STORE,
      keyPath: "id",
    },
    {
      name: OFFLINE_MUTATIONS_STORE,
      keyPath: "id",
      indexes: [{ name: "collectionId", keyPath: "collectionId" }],
    },
  ],
} as const;
