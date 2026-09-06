import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import { toActionFailureCode } from "@/shared/lib/action-failure-code";
import { validateEvidenceFile } from "@/shared/lib/file-validation";
import {
  collectionIdSchema,
  draftCreateSchema,
  draftPatchSchema,
  itemCreateCommandSchema,
  itemIdSchema,
  itemPatchCommandSchema,
  type DraftDTO,
  type DraftItemDTO,
  type EvidenceDTO,
} from "../model/draft";

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
type PhaseOneClient = Readonly<{
  from(table: "collections" | "collection_items" | "evidences" | "collection_events" | "signatures"): Query;
  rpc(functionName: string, args: Readonly<Record<string, unknown>>): Promise<DatabaseResponse>;
  storage: Readonly<{ from(bucket: "collection-evidences"): StorageBucket }>;
}>;

const draftColumns = "id,customer_id,status,collection_location,responsible_name,responsible_tax_id,collected_at,row_version,created_at,updated_at";
const itemColumns = "id,description,quantity,condition_note,observation,created_at,updated_at";
const draftRowSchema = z.object({ id: z.string().uuid(), customer_id: z.string().uuid().nullable(), status: z.literal("draft"), collection_location: z.string().nullable(), responsible_name: z.string().nullable(), responsible_tax_id: z.string().nullable(), collected_at: z.string().nullable(), row_version: z.number().int().positive(), created_at: z.string(), updated_at: z.string() });
const draftDtoRowSchema = z.object({ id: z.string().uuid(), customerId: z.string().uuid().nullable(), status: z.literal("draft"), collectionLocation: z.string().nullable(), responsibleName: z.string().nullable(), responsibleTaxId: z.string().nullable(), collectedAt: z.string().nullable(), rowVersion: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string() });
const itemRowSchema = z.object({ id: z.string().uuid(), description: z.string(), quantity: z.number(), condition_note: z.string().nullable(), observation: z.string().nullable(), created_at: z.string(), updated_at: z.string() });
const itemDtoRowSchema = z.object({ id: z.string().uuid(), description: z.string(), quantity: z.number(), condition: z.string().nullable().optional(), conditionNote: z.string().nullable().optional(), notes: z.string().nullable().optional(), observation: z.string().nullable().optional(), createdAt: z.string(), updatedAt: z.string() });
const evidenceRowSchema = z.object({ id: z.string().uuid(), collection_item_id: z.string().uuid().nullable(), content_type: z.enum(["image/png", "image/jpeg", "image/webp"]), byte_size: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), created_at: z.string() });
const evidenceDtoRowSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid().nullable(), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), sizeBytes: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), createdAt: z.string() });
const uploadIntentSchema = z.object({ intentId: z.string().uuid(), storagePath: z.string().min(1), rowVersion: z.number().int().positive().optional() });
const uploadCommitSchema = z.object({ rowVersion: z.number().int().positive() });

function respond(status: number, body: unknown): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function failureResponse(request: Request, operation: string, code: string, actorId: string | null): NextResponse {
  logTransactionFailure({ requestId: getRequestId(request), operation, code, actorId, status: 500 });
  return respond(500, { ok: false, code });
}

async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function mapDraft(value: unknown): DraftDTO | null {
  const database = draftRowSchema.safeParse(value);
  if (database.success) return { id: database.data.id, customerId: database.data.customer_id, status: database.data.status, collectionLocation: database.data.collection_location, responsibleName: database.data.responsible_name, responsibleTaxId: database.data.responsible_tax_id, collectedAt: database.data.collected_at, rowVersion: database.data.row_version, createdAt: database.data.created_at, updatedAt: database.data.updated_at };
  const dto = draftDtoRowSchema.safeParse(value);
  return dto.success ? dto.data : null;
}

function mapItem(value: unknown): DraftItemDTO | null {
  const database = itemRowSchema.safeParse(value);
  if (database.success) return { id: database.data.id, description: database.data.description, quantity: database.data.quantity, condition: database.data.condition_note, notes: database.data.observation, createdAt: database.data.created_at, updatedAt: database.data.updated_at };
  const dto = itemDtoRowSchema.safeParse(value);
  return dto.success ? { id: dto.data.id, description: dto.data.description, quantity: dto.data.quantity, condition: dto.data.condition ?? dto.data.conditionNote ?? null, notes: dto.data.notes ?? dto.data.observation ?? null, createdAt: dto.data.createdAt, updatedAt: dto.data.updatedAt } : null;
}

function mapEvidence(value: unknown): EvidenceDTO | null {
  const database = evidenceRowSchema.safeParse(value);
  if (database.success) {
    const row = database.data;
    return { id: row.id, itemId: row.collection_item_id, mimeType: row.content_type, sizeBytes: row.byte_size, sha256: row.sha256, createdAt: row.created_at };
  }
  const dto = evidenceDtoRowSchema.safeParse(value);
  return dto.success ? { id: dto.data.id, itemId: dto.data.itemId, mimeType: dto.data.mimeType, sizeBytes: dto.data.sizeBytes, sha256: dto.data.sha256, createdAt: dto.data.createdAt } : null;
}

function objectProperty(value: unknown, property: string): unknown {
  return typeof value === "object" && value !== null && property in value ? value[property as keyof typeof value] : undefined;
}

function propertyString(value: unknown, property: string): string | null {
  const candidate = objectProperty(value, property);
  return typeof candidate === "string" ? candidate : null;
}

function databaseErrorCode(error: unknown): string | null {
  return propertyString(error, "code");
}

function databaseErrorMessage(error: unknown): string | null {
  return propertyString(error, "message");
}

function errorResponse(error: unknown, request: Request, operation: string, actorId: string | null): NextResponse {
  if (error instanceof AuthenticationRequiredError) return respond(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return respond(403, { ok: false, code: "forbidden" });
  const code = databaseErrorCode(error);
  if (code === "40001" || databaseErrorMessage(error) === "stale_version") return respond(409, { ok: false, code: "stale_version" });
  if (code === "42501") return respond(403, { ok: false, code: "forbidden" });
  logTransactionFailure({ requestId: getRequestId(request), operation, code: "draft_unexpected_error", actorId, status: 500 });
  return respond(500, { ok: false, code: "unexpected_error" });
}

function rpcErrorResponse(error: unknown, request: Request, operation: string, actorId: string): NextResponse {
  const code = databaseErrorCode(error);
  const message = databaseErrorMessage(error);
  if (code === "40001" || message === "stale_version") return respond(409, { ok: false, code: "stale_version" });
  if (code === "42501") return respond(403, { ok: false, code: "forbidden" });
  if (code === "P0001" && message === "collection_not_draft") return respond(409, { ok: false, code: "collection_not_draft" });
  if (code === "P0001" && message === "collection_item_not_found") return respond(404, { ok: false, code: "not_found" });
  if (code === "P0001" && message === "collection_item_mismatch") return respond(422, { ok: false, code: "collection_item_mismatch" });
  if (code === "P0001" && message === "invalid_expected_version") return respond(422, { ok: false, code: "validation_error" });
  logTransactionFailure({ requestId: getRequestId(request), operation, code: code ?? `${operation}_failed`, actorId, status: 500 });
  return respond(500, { ok: false, code: `${operation}_failed` });
}

function mutationRowVersion(value: unknown): number | null {
  const candidate = objectProperty(value, "rowVersion");
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

function mutationItemId(value: unknown): string | null {
  const direct = objectProperty(value, "itemId");
  if (typeof direct === "string" && z.string().uuid().safeParse(direct).success) return direct;
  const nested = objectProperty(objectProperty(value, "item"), "id");
  return typeof nested === "string" && z.string().uuid().safeParse(nested).success ? nested : null;
}

function mutationEvidenceId(value: unknown): string | null {
  const direct = objectProperty(value, "evidenceId");
  return typeof direct === "string" && z.string().uuid().safeParse(direct).success ? direct : null;
}

async function loadDraft(supabase: PhaseOneClient, collectionId: string): Promise<DraftDTO | null> {
  const query = await supabase.from("collections").select(draftColumns).eq("id", collectionId).eq("status", "draft").maybeSingle();
  return query.error ? null : mapDraft(query.data);
}

async function loadItem(supabase: PhaseOneClient, collectionId: string, itemId: string): Promise<DraftItemDTO | null> {
  const query = await supabase.from("collection_items").select(itemColumns).eq("collection_id", collectionId).eq("id", itemId).is("removed_at", null).maybeSingle();
  return query.error ? null : mapItem(query.data);
}

async function loadEvidence(supabase: PhaseOneClient, collectionId: string, evidenceId: string): Promise<EvidenceDTO | null> {
  const query = await supabase.from("evidences").select("id,collection_item_id,content_type,byte_size,sha256,created_at").eq("collection_id", collectionId).eq("id", evidenceId).maybeSingle();
  return query.error ? null : mapEvidence(query.data);
}

function isSafeStoragePath(value: string): boolean {
  return value.length <= 512 && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") && /^[A-Za-z0-9/_-]+\.(png|jpg|jpeg|webp)$/.test(value);
}

type UploadCompensationResult = "canceled_and_removed" | "already_committed" | "failed";

async function cancelUpload(supabase: PhaseOneClient, intentId: string, storagePath: string): Promise<UploadCompensationResult> {
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
    // The canceled intent remains traceable for the cleanup worker.
    return "failed";
  }
}

export async function createDraft(request: Request): Promise<NextResponse> {
  try {
    const input = draftCreateSchema.safeParse(await json(request));
    if (!input.success) return respond(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const existing = await supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", input.data.id).maybeSingle();
    if (existing.error) return failureResponse(request, "create_draft", "draft_query_failed", administrator.userId);
    const previous = mapDraft(existing.data);
    if (previous) return respond(200, { ok: true, data: { draft: previous, idempotent: true } });
    // `row_version` is not in the authenticated INSERT grant; the column default is 1 and RLS requires that default.
    const { data, error } = await supabase.from("collections").insert({ id: input.data.id, organization_id: administrator.organizationId, customer_id: input.data.customerId ?? null, status: "draft", created_by: administrator.userId, updated_by: administrator.userId }).select(draftColumns).maybeSingle();
    if (error && databaseErrorCode(error) === "23505") {
      const replay = await supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", input.data.id).maybeSingle();
      const replayed = replay.error ? null : mapDraft(replay.data);
      if (replayed) return respond(200, { ok: true, data: { draft: replayed, idempotent: true } });
    }
    const draft = mapDraft(data);
    if (error || !draft) return respond(409, { ok: false, code: "draft_create_conflict" });
    await supabase.from("collection_events").insert({ organization_id: administrator.organizationId, collection_id: draft.id, actor_user_id: administrator.userId, event_type: "collection.draft.created", metadata: {} });
    return respond(201, { ok: true, data: { draft, idempotent: false } });
  } catch (error: unknown) {
    return errorResponse(error, request, "create_draft", null);
  }
}

export async function collectionExists(collectionId: string): Promise<boolean> {
  const parsedId = collectionIdSchema.safeParse(collectionId);
  if (!parsedId.success) return false;
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
  const query = await supabase
    .from("collections")
    .select("id")
    .eq("organization_id", administrator.organizationId)
    .eq("id", parsedId.data)
    .maybeSingle();
  return !query.error && query.data != null;
}

export async function getDraft(id: string, request?: Request): Promise<NextResponse> {
  try {
    const parsedId = collectionIdSchema.safeParse(id);
    if (!parsedId.success) return respond(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const [draftResult, itemResult, signatureResult] = await Promise.all([
      supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "draft").maybeSingle(),
      supabase.from("collection_items").select(itemColumns).eq("organization_id", administrator.organizationId).eq("collection_id", parsedId.data).is("removed_at", null).order("created_at", { ascending: true }),
      supabase.from("signatures").select("id").eq("collection_id", parsedId.data).maybeSingle(),
    ]);
    const draft = mapDraft(draftResult.data);
    if (draftResult.error) return failureResponse(request ?? new Request("http://localhost/api/collections"), "get_draft", "draft_query_failed", administrator.userId);
    if (!draft) return respond(404, { ok: false, code: "not_found" });
    const items = Array.isArray(itemResult.data) ? itemResult.data.map(mapItem).filter((value): value is DraftItemDTO => value !== null) : [];
    const hasSignature = signatureResult.data !== null && signatureResult.data !== undefined && !signatureResult.error;
    return respond(200, { ok: true, data: { draft, items, hasSignature } });
  } catch (error: unknown) {
    return errorResponse(error, request ?? new Request("http://localhost/api/collections"), "get_draft", null);
  }
}

export async function patchDraft(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = collectionIdSchema.safeParse(id);
    const input = draftPatchSchema.safeParse(await json(request));
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { error } = await supabase.rpc("update_collection_draft", {
      p_collection_id: parsedId.data,
      p_expected_version: input.data.expectedVersion,
      p_patch: {
        ...(input.data.customerId === undefined ? {} : { customer_id: input.data.customerId }),
        ...(input.data.collectionLocation === undefined ? {} : { collection_location: input.data.collectionLocation }),
        ...(input.data.responsibleName === undefined ? {} : { responsible_name: input.data.responsibleName }),
        ...(input.data.responsibleTaxId === undefined ? {} : { responsible_tax_id: input.data.responsibleTaxId }),
        ...(input.data.collectedAt === undefined ? {} : { collected_at: input.data.collectedAt }),
      },
    });
    if (error) return rpcErrorResponse(error, request, "draft_update", administrator.userId);
    const draft = await loadDraft(supabase, parsedId.data);
    if (!draft) return failureResponse(request, "patch_draft", "draft_update_contract_invalid", administrator.userId);
    return respond(200, { ok: true, data: { draft } });
  } catch (error: unknown) {
    return errorResponse(error, request, "patch_draft", null);
  }
}

export async function addItem(request: Request, collectionId: string): Promise<NextResponse> {
  try {
    const id = collectionIdSchema.safeParse(collectionId);
    const input = itemCreateCommandSchema.safeParse(await json(request));
    if (!id.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.rpc("create_collection_item", {
      p_collection_id: id.data,
      p_expected_version: input.data.expectedVersion,
      p_description: input.data.description,
      p_quantity: input.data.quantity,
      p_condition_note: input.data.condition ?? null,
      p_observation: input.data.notes ?? null,
      p_client_item_id: input.data.clientItemId ?? null,
    });
    if (error) return rpcErrorResponse(error, request, "item_create", administrator.userId);
    const itemId = mutationItemId(data) ?? input.data.clientItemId ?? null;
    const created = itemId ? await loadItem(supabase, id.data, itemId) : null;
    const draft = await loadDraft(supabase, id.data);
    if (!created || !draft || mutationRowVersion(data) !== draft.rowVersion) return failureResponse(request, "add_item", "item_create_contract_invalid", administrator.userId);
    return respond(201, { ok: true, data: { item: created, draft, rowVersion: draft.rowVersion } });
  } catch (error: unknown) {
    return errorResponse(error, request, "add_item", null);
  }
}

export async function patchItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId);
    const item = itemIdSchema.safeParse(itemId);
    const input = itemPatchCommandSchema.safeParse(await json(request));
    if (!collection.success || !item.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.rpc("update_collection_item", {
      p_collection_id: collection.data,
      p_item_id: item.data,
      p_expected_version: input.data.expectedVersion,
      p_patch: {
        ...(input.data.description === undefined ? {} : { description: input.data.description }),
        ...(input.data.quantity === undefined ? {} : { quantity: input.data.quantity }),
        ...(input.data.condition === undefined ? {} : { condition_note: input.data.condition }),
        ...(input.data.notes === undefined ? {} : { observation: input.data.notes }),
      },
    });
    if (error) return rpcErrorResponse(error, request, "item_update", administrator.userId);
    const updated = await loadItem(supabase, collection.data, item.data);
    const draft = await loadDraft(supabase, collection.data);
    if (!updated || !draft || mutationRowVersion(data) !== draft.rowVersion) return failureResponse(request, "patch_item", "item_update_contract_invalid", administrator.userId);
    return respond(200, { ok: true, data: { item: updated, draft, rowVersion: draft.rowVersion } });
  } catch (error: unknown) {
    return errorResponse(error, request, "patch_item", null);
  }
}

export async function removeItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId);
    const item = itemIdSchema.safeParse(itemId);
    const input = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await json(request));
    if (!collection.success || !item.success || !input.success) return respond(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.rpc("remove_collection_item", { p_collection_id: collection.data, p_item_id: item.data, p_expected_version: input.data.expectedVersion });
    if (error) return rpcErrorResponse(error, request, "item_remove", administrator.userId);
    const draft = await loadDraft(supabase, collection.data);
    if (!draft || mutationRowVersion(data) !== draft.rowVersion) return failureResponse(request, "remove_item", "item_remove_contract_invalid", administrator.userId);
    return respond(200, { ok: true, data: { draft, rowVersion: draft.rowVersion } });
  } catch (error: unknown) {
    return errorResponse(error, request, "remove_item", null);
  }
}

export async function uploadEvidence(request: Request, collectionId: string): Promise<NextResponse> {
  let intentId: string | null = null;
  let storagePath: string | null = null;
  let actorId: string | null = null;
  let supabase: PhaseOneClient | null = null;
  let commitSucceeded = false;
  try {
    const id = collectionIdSchema.safeParse(collectionId);
    if (!id.success) return respond(400, { ok: false, code: "validation_error" });
    const formData = await request.formData();
    const expectedVersion = z.coerce.number().int().positive().safeParse(formData.get("expectedVersion"));
    const itemValue = formData.get("itemId");
    const parsedItemId = itemValue === null || itemValue === "" ? null : itemIdSchema.safeParse(itemValue);
    if (!expectedVersion.success || (parsedItemId !== null && !parsedItemId.success)) return respond(400, { ok: false, code: "validation_error" });
    const file = formData.get("file");
    const fileValidation = await validateEvidenceFile(file);
    if (!fileValidation.valid || !(file instanceof File)) return respond(400, { ok: false, code: "invalid_file" });
    const administrator = await requireAuthenticatedAdministrator();
    actorId = administrator.userId;
    supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const prepared = await supabase.rpc("prepare_collection_upload", {
      p_collection_id: id.data,
      p_expected_version: expectedVersion.data,
      p_kind: "evidence",
      p_item_id: parsedItemId === null ? null : parsedItemId.data,
      p_content_type: file.type,
      p_byte_size: file.size,
      p_sha256: fileValidation.sha256,
      p_extension: fileValidation.extension,
    });
    if (prepared.error) return rpcErrorResponse(prepared.error, request, "evidence_prepare", administrator.userId);
    const intent = uploadIntentSchema.safeParse(prepared.data);
    if (!intent.success || !isSafeStoragePath(intent.data.storagePath)) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_prepare", code: "evidence_prepare_contract_invalid", actorId: administrator.userId, status: 500 });
      return respond(500, { ok: false, code: "evidence_prepare_contract_invalid" });
    }
    intentId = intent.data.intentId;
    storagePath = intent.data.storagePath;
    const upload = await supabase.storage.from("collection-evidences").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      const compensation = await cancelUpload(supabase, intentId, storagePath);
      if (compensation === "failed") logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_upload_compensation", code: "evidence_compensation_failed", actorId: administrator.userId, status: 500 });
      return failureResponse(request, "upload_evidence", "evidence_upload_failed", administrator.userId);
    }
    const committed = await supabase.rpc("commit_collection_upload", { p_upload_intent_id: intentId, p_expected_version: expectedVersion.data });
    if (committed.error) {
      const compensation = await cancelUpload(supabase, intentId, storagePath);
      if (compensation === "failed") logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_commit_compensation", code: "evidence_compensation_failed", actorId: administrator.userId, status: 500 });
      return rpcErrorResponse(committed.error, request, "evidence_commit", administrator.userId);
    }
    commitSucceeded = true;
    const commit = uploadCommitSchema.safeParse(committed.data);
    const evidenceId = mutationEvidenceId(committed.data);
    const evidence = commit.success && evidenceId ? await loadEvidence(supabase, id.data, evidenceId) : null;
    if (!commit.success || !evidence || !evidenceId) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_commit", code: "evidence_commit_contract_invalid", actorId: administrator.userId, status: 500 });
      return respond(500, { ok: false, code: "evidence_commit_contract_invalid" });
    }
    return respond(201, { ok: true, data: { evidence, rowVersion: commit.data.rowVersion } });
  } catch (error: unknown) {
    let compensation: UploadCompensationResult | null = null;
    if (!commitSucceeded && intentId && storagePath && supabase) await cancelUpload(supabase, intentId, storagePath).then((value) => { compensation = value; });
    if (compensation === "failed") {
      logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_upload_compensation", code: "evidence_compensation_failed", actorId, status: 500 });
    } else if (commitSucceeded) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "evidence_post_commit_response", code: "evidence_post_commit_response_failed", actorId, status: 500 });
    }
    return errorResponse(error, request, "upload_evidence", actorId);
  }
}

const discardResultSchema = z.object({
  ok: z.literal(true),
  collectionId: z.string().uuid(),
});

function mapDiscardRpcError(error: unknown): string {
  const code = databaseErrorCode(error);
  const message = databaseErrorMessage(error);
  if (code === "40001" || message === "stale_version") {
    return "stale_version";
  }
  if (code === "42501") {
    return "forbidden";
  }
  if (code === "P0001" && message === "collection_not_draft") {
    return "collection_not_draft";
  }
  if (code === "P0001" && message === "invalid_discard_request") {
    return "invalid_discard_request";
  }
  if (code === "P0001" && message === "not_found") {
    return "not_found";
  }
  return toActionFailureCode(error);
}

export async function discardCollectionDraft(
  collectionId: string,
  expectedVersion: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedId = collectionIdSchema.safeParse(collectionId);
  if (!parsedId.success || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { ok: false, error: "validation_error" };
  }
  try {
    await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.rpc("discard_collection_draft", {
      p_collection_id: parsedId.data,
      p_expected_version: expectedVersion,
    });
    if (error) {
      return { ok: false, error: mapDiscardRpcError(error) };
    }
    const parsed = discardResultSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: "operation_failed" };
    }
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return { ok: false, error: "authentication_required" };
    }
    if (error instanceof AdministratorAccessDeniedError) {
      return { ok: false, error: "administrator_access_denied" };
    }
    return { ok: false, error: toActionFailureCode(error) };
  }
}
