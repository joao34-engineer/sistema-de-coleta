import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import type { DraftDTO, DraftItemDTO, EvidenceDTO } from "../model/draft";

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
type Query = PromiseLike<DatabaseResponse> & {
  select(columns: string): Query;
  insert(values: unknown): Query;
  update(values: unknown): Query;
  eq(column: string, value: unknown): Query;
  is(column: string, value: null): Query;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): Query;
  maybeSingle(): Query;
};
type StorageBucket = Readonly<{
  upload(path: string, file: File, options: Readonly<{ contentType: string; upsert: false }>): Promise<Readonly<{ error: unknown }>>;
  remove(paths: readonly string[]): Promise<Readonly<{ error: unknown }>>;
}>;

export type PhaseOneClient = Readonly<{
  from(table: "collections" | "collection_items" | "evidences" | "collection_events" | "signatures"): Query;
  rpc(functionName: string, args: Readonly<Record<string, unknown>>): Promise<DatabaseResponse>;
  storage: Readonly<{ from(bucket: "collection-evidences"): StorageBucket }>;
}>;

export const draftColumns = "id,customer_id,status,collection_location,responsible_name,responsible_tax_id,collected_at,row_version,created_at,updated_at";
export const itemColumns = "id,description,quantity,condition_note,observation,created_at,updated_at";

const draftRowSchema = z.object({ id: z.string().uuid(), customer_id: z.string().uuid().nullable(), status: z.literal("draft"), collection_location: z.string().nullable(), responsible_name: z.string().nullable(), responsible_tax_id: z.string().nullable(), collected_at: z.string().nullable(), row_version: z.number().int().positive(), created_at: z.string(), updated_at: z.string() });
const draftDtoRowSchema = z.object({ id: z.string().uuid(), customerId: z.string().uuid().nullable(), status: z.literal("draft"), collectionLocation: z.string().nullable(), responsibleName: z.string().nullable(), responsibleTaxId: z.string().nullable(), collectedAt: z.string().nullable(), rowVersion: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string() });
const itemRowSchema = z.object({ id: z.string().uuid(), description: z.string(), quantity: z.number(), condition_note: z.string().nullable(), observation: z.string().nullable(), created_at: z.string(), updated_at: z.string() });
const itemDtoRowSchema = z.object({ id: z.string().uuid(), description: z.string(), quantity: z.number(), condition: z.string().nullable().optional(), conditionNote: z.string().nullable().optional(), notes: z.string().nullable().optional(), observation: z.string().nullable().optional(), createdAt: z.string(), updatedAt: z.string() });
const evidenceRowSchema = z.object({ id: z.string().uuid(), collection_item_id: z.string().uuid().nullable(), content_type: z.enum(["image/png", "image/jpeg", "image/webp"]), byte_size: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), created_at: z.string() });
const evidenceDtoRowSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid().nullable(), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), sizeBytes: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), createdAt: z.string() });

export const uploadIntentSchema = z.object({ intentId: z.string().uuid(), storagePath: z.string().min(1), rowVersion: z.number().int().positive().optional() });
export const uploadCommitSchema = z.object({ rowVersion: z.number().int().positive() });

export async function createPhaseOneClient(): Promise<PhaseOneClient> {
  return (await createServerSupabaseClient()) as unknown as PhaseOneClient;
}

export function mapDraft(value: unknown): DraftDTO | null {
  const database = draftRowSchema.safeParse(value);
  if (database.success) return { id: database.data.id, customerId: database.data.customer_id, status: database.data.status, collectionLocation: database.data.collection_location, responsibleName: database.data.responsible_name, responsibleTaxId: database.data.responsible_tax_id, collectedAt: database.data.collected_at, rowVersion: database.data.row_version, createdAt: database.data.created_at, updatedAt: database.data.updated_at };
  const dto = draftDtoRowSchema.safeParse(value);
  return dto.success ? dto.data : null;
}

export function mapItem(value: unknown): DraftItemDTO | null {
  const database = itemRowSchema.safeParse(value);
  if (database.success) return { id: database.data.id, description: database.data.description, quantity: database.data.quantity, condition: database.data.condition_note, notes: database.data.observation, createdAt: database.data.created_at, updatedAt: database.data.updated_at };
  const dto = itemDtoRowSchema.safeParse(value);
  return dto.success ? { id: dto.data.id, description: dto.data.description, quantity: dto.data.quantity, condition: dto.data.condition ?? dto.data.conditionNote ?? null, notes: dto.data.notes ?? dto.data.observation ?? null, createdAt: dto.data.createdAt, updatedAt: dto.data.updatedAt } : null;
}

export function mapEvidence(value: unknown): EvidenceDTO | null {
  const database = evidenceRowSchema.safeParse(value);
  if (database.success) {
    const row = database.data;
    return { id: row.id, itemId: row.collection_item_id, mimeType: row.content_type, sizeBytes: row.byte_size, sha256: row.sha256, createdAt: row.created_at };
  }
  const dto = evidenceDtoRowSchema.safeParse(value);
  return dto.success ? { id: dto.data.id, itemId: dto.data.itemId, mimeType: dto.data.mimeType, sizeBytes: dto.data.sizeBytes, sha256: dto.data.sha256, createdAt: dto.data.createdAt } : null;
}

export function objectProperty(value: unknown, property: string): unknown {
  return typeof value === "object" && value !== null && property in value ? value[property as keyof typeof value] : undefined;
}

export function propertyString(value: unknown, property: string): string | null {
  const candidate = objectProperty(value, property);
  return typeof candidate === "string" ? candidate : null;
}

export function databaseErrorCode(error: unknown): string | null {
  return propertyString(error, "code");
}

export function databaseErrorMessage(error: unknown): string | null {
  return propertyString(error, "message");
}

export function mutationRowVersion(value: unknown): number | null {
  const candidate = objectProperty(value, "rowVersion");
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

export function mutationItemId(value: unknown): string | null {
  const direct = objectProperty(value, "itemId");
  if (typeof direct === "string" && z.string().uuid().safeParse(direct).success) return direct;
  const nested = objectProperty(objectProperty(value, "item"), "id");
  return typeof nested === "string" && z.string().uuid().safeParse(nested).success ? nested : null;
}

export function mutationEvidenceId(value: unknown): string | null {
  const direct = objectProperty(value, "evidenceId");
  return typeof direct === "string" && z.string().uuid().safeParse(direct).success ? direct : null;
}

export async function loadDraft(supabase: PhaseOneClient, collectionId: string): Promise<DraftDTO | null> {
  const query = await supabase.from("collections").select(draftColumns).eq("id", collectionId).eq("status", "draft").maybeSingle();
  return query.error ? null : mapDraft(query.data);
}

export async function loadItem(supabase: PhaseOneClient, collectionId: string, itemId: string): Promise<DraftItemDTO | null> {
  const query = await supabase.from("collection_items").select(itemColumns).eq("collection_id", collectionId).eq("id", itemId).is("removed_at", null).maybeSingle();
  return query.error ? null : mapItem(query.data);
}

export async function loadEvidence(supabase: PhaseOneClient, collectionId: string, evidenceId: string): Promise<EvidenceDTO | null> {
  const query = await supabase.from("evidences").select("id,collection_item_id,content_type,byte_size,sha256,created_at").eq("collection_id", collectionId).eq("id", evidenceId).maybeSingle();
  return query.error ? null : mapEvidence(query.data);
}

export function isSafeStoragePath(value: string): boolean {
  return value.length <= 512 && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") && /^[A-Za-z0-9/_-]+\.(png|jpg|jpeg|webp)$/.test(value);
}

export type UploadCompensationResult = "canceled_and_removed" | "already_committed" | "failed";

export async function cancelUpload(supabase: PhaseOneClient, intentId: string, storagePath: string): Promise<UploadCompensationResult> {
  let cancelError: unknown = null;
  try {
    const canceled = await supabase.rpc("cancel_collection_upload", { p_upload_intent_id: intentId });
    if (canceled.error) cancelError = canceled.error;
  } catch (error: unknown) {
    cancelError = error;
  }
  const cancelMessage = databaseErrorMessage(cancelError);
  if (cancelMessage === "upload_already_committed") return "already_committed";
  if (cancelError) return "failed";
  try {
    const removed = await supabase.storage.from("collection-evidences").remove([storagePath]);
    return removed.error ? "failed" : "canceled_and_removed";
  } catch {
    return "failed";
  }
}
