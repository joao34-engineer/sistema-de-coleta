import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { validateEvidenceFile } from "@/shared/lib/file-validation";
import { collectionIdSchema, draftCreateSchema, draftPatchSchema, expectedVersionSchema, itemCreateSchema, itemIdSchema, itemPatchSchema, type DraftDTO, type DraftItemDTO, type EvidenceDTO } from "../model/draft";

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
type Query = PromiseLike<DatabaseResponse> & { select(columns: string): Query; insert(values: unknown): Query; update(values: unknown): Query; eq(column: string, value: unknown): Query; is(column: string, value: null): Query; order(column: string, options?: Readonly<{ ascending?: boolean }>): Query; maybeSingle(): Query };
type StorageBucket = Readonly<{ upload(path: string, file: File, options: Readonly<{ contentType: string; upsert: false }>): Promise<Readonly<{ error: unknown }>> }>;
type PhaseOneClient = Readonly<{ from(table: "collections" | "collection_items" | "evidences" | "collection_events"): Query; storage: Readonly<{ from(bucket: "collection-evidences"): StorageBucket }> }>;

const draftColumns = "id,customer_id,status,collection_location,responsible_name,responsible_tax_id,collected_at,row_version,created_at,updated_at";
const itemColumns = "id,description,quantity,condition_note,observation,created_at,updated_at";
const draftRowSchema = z.object({ id: z.string().uuid(), customer_id: z.string().uuid().nullable(), status: z.literal("draft"), collection_location: z.string().nullable(), responsible_name: z.string().nullable(), responsible_tax_id: z.string().nullable(), collected_at: z.string().nullable(), row_version: z.number().int().positive(), created_at: z.string(), updated_at: z.string() });
const itemRowSchema = z.object({ id: z.string().uuid(), description: z.string(), quantity: z.number(), condition_note: z.string().nullable(), observation: z.string().nullable(), created_at: z.string(), updated_at: z.string() });
const evidenceRowSchema = z.object({ id: z.string().uuid(), collection_item_id: z.string().uuid().nullable(), content_type: z.enum(["image/png", "image/jpeg", "image/webp"]), byte_size: z.number().int().positive(), created_at: z.string() });

function respond(status: number, body: unknown): NextResponse { const response = NextResponse.json(body, { status }); response.headers.set("Cache-Control", "no-store"); return response; }
function errorResponse(error: unknown): NextResponse { if (error instanceof AuthenticationRequiredError) return respond(401, { ok: false, code: "authentication_required" }); if (error instanceof AdministratorAccessDeniedError) return respond(403, { ok: false, code: "forbidden" }); return respond(500, { ok: false, code: "unexpected_error" }); }
async function json(request: Request): Promise<unknown> { try { return await request.json(); } catch { return null; } }
function mapDraft(value: unknown): DraftDTO | null { const parsed = draftRowSchema.safeParse(value); return parsed.success ? { id: parsed.data.id, customerId: parsed.data.customer_id, status: parsed.data.status, collectionLocation: parsed.data.collection_location, responsibleName: parsed.data.responsible_name, responsibleTaxId: parsed.data.responsible_tax_id, collectedAt: parsed.data.collected_at, rowVersion: parsed.data.row_version, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at } : null; }
function mapItem(value: unknown): DraftItemDTO | null { const parsed = itemRowSchema.safeParse(value); return parsed.success ? { id: parsed.data.id, description: parsed.data.description, quantity: parsed.data.quantity, condition: parsed.data.condition_note, notes: parsed.data.observation, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at } : null; }
function mapEvidence(value: unknown): EvidenceDTO | null { const parsed = evidenceRowSchema.safeParse(value); return parsed.success ? { id: parsed.data.id, itemId: parsed.data.collection_item_id, mimeType: parsed.data.content_type, sizeBytes: parsed.data.byte_size, createdAt: parsed.data.created_at } : null; }

export async function createDraft(request: Request): Promise<NextResponse> {
  try {
    const input = draftCreateSchema.safeParse(await json(request));
    if (!input.success) return respond(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const existing = await supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", input.data.id).maybeSingle();
    if (existing.error) return respond(500, { ok: false, code: "draft_query_failed" });
    const previous = mapDraft(existing.data);
    if (previous) return respond(200, { ok: true, data: { draft: previous, idempotent: true } });
    const { data, error } = await supabase.from("collections").insert({ id: input.data.id, organization_id: administrator.organizationId, customer_id: input.data.customerId ?? null, status: "draft", row_version: 1, created_by: administrator.userId, updated_by: administrator.userId }).select(draftColumns).maybeSingle();
    const draft = mapDraft(data);
    if (error || !draft) return respond(409, { ok: false, code: "draft_create_conflict" });
    await supabase.from("collection_events").insert({ organization_id: administrator.organizationId, collection_id: draft.id, actor_user_id: administrator.userId, event_type: "collection.draft.created", metadata: {} });
    return respond(201, { ok: true, data: { draft, idempotent: false } });
  } catch (error: unknown) { return errorResponse(error); }
}

export async function getDraft(id: string): Promise<NextResponse> {
  try {
    const parsedId = collectionIdSchema.safeParse(id); if (!parsedId.success) return respond(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const [draftResult, itemResult] = await Promise.all([supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "draft").maybeSingle(), supabase.from("collection_items").select(itemColumns).eq("organization_id", administrator.organizationId).eq("collection_id", parsedId.data).is("removed_at", null).order("created_at", { ascending: true })]);
    const draft = mapDraft(draftResult.data); if (draftResult.error) return respond(500, { ok: false, code: "draft_query_failed" }); if (!draft) return respond(404, { ok: false, code: "not_found" });
    const items = Array.isArray(itemResult.data) ? itemResult.data.map(mapItem).filter((value): value is DraftItemDTO => value !== null) : [];
    return respond(200, { ok: true, data: { draft, items } });
  } catch (error: unknown) { return errorResponse(error); }
}

export async function patchDraft(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = collectionIdSchema.safeParse(id); const input = draftPatchSchema.safeParse(await json(request));
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const values = { ...(input.data.customerId === undefined ? {} : { customer_id: input.data.customerId }), ...(input.data.collectionLocation === undefined ? {} : { collection_location: input.data.collectionLocation }), ...(input.data.responsibleName === undefined ? {} : { responsible_name: input.data.responsibleName }), ...(input.data.responsibleTaxId === undefined ? {} : { responsible_tax_id: input.data.responsibleTaxId }), ...(input.data.collectedAt === undefined ? {} : { collected_at: input.data.collectedAt }), row_version: input.data.expectedVersion + 1, updated_by: administrator.userId };
    const { data, error } = await supabase.from("collections").update(values).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "draft").eq("row_version", input.data.expectedVersion).select(draftColumns).maybeSingle();
    const draft = mapDraft(data); if (error) return respond(409, { ok: false, code: "stale_version" }); if (!draft) return respond(409, { ok: false, code: "stale_version" });
    await supabase.from("collection_events").insert({ organization_id: administrator.organizationId, collection_id: draft.id, actor_user_id: administrator.userId, event_type: "collection.draft.updated", metadata: { row_version: draft.rowVersion } });
    return respond(200, { ok: true, data: { draft } });
  } catch (error: unknown) { return errorResponse(error); }
}

async function requireDraft(supabase: PhaseOneClient, organizationId: number, id: string): Promise<DraftDTO | null> { const query = await supabase.from("collections").select(draftColumns).eq("organization_id", organizationId).eq("id", id).eq("status", "draft").maybeSingle(); return query.error ? null : mapDraft(query.data); }

export async function addItem(request: Request, collectionId: string): Promise<NextResponse> {
  try {
    const id = collectionIdSchema.safeParse(collectionId); const input = itemCreateSchema.safeParse(await json(request)); if (!id.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient; if (!await requireDraft(supabase, administrator.organizationId, id.data)) return respond(404, { ok: false, code: "not_found" });
    const { data, error } = await supabase.from("collection_items").insert({ organization_id: administrator.organizationId, collection_id: id.data, description: input.data.description, quantity: input.data.quantity, condition_note: input.data.condition ?? null, observation: input.data.notes ?? null, created_by: administrator.userId }).select(itemColumns).maybeSingle(); const item = mapItem(data); if (error || !item) return respond(500, { ok: false, code: "item_create_failed" }); return respond(201, { ok: true, data: { item } });
  } catch (error: unknown) { return errorResponse(error); }
}

export async function patchItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId); const item = itemIdSchema.safeParse(itemId); const input = itemPatchSchema.safeParse(await json(request)); if (!collection.success || !item.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient; if (!await requireDraft(supabase, administrator.organizationId, collection.data)) return respond(404, { ok: false, code: "not_found" });
    const values = { ...(input.data.description === undefined ? {} : { description: input.data.description }), ...(input.data.quantity === undefined ? {} : { quantity: input.data.quantity }), ...(input.data.condition === undefined ? {} : { condition_note: input.data.condition }), ...(input.data.notes === undefined ? {} : { observation: input.data.notes }) };
    const { data, error } = await supabase.from("collection_items").update(values).eq("organization_id", administrator.organizationId).eq("collection_id", collection.data).eq("id", item.data).is("removed_at", null).select(itemColumns).maybeSingle(); const updated = mapItem(data); if (error) return respond(500, { ok: false, code: "item_update_failed" }); if (!updated) return respond(404, { ok: false, code: "not_found" }); return respond(200, { ok: true, data: { item: updated } });
  } catch (error: unknown) { return errorResponse(error); }
}

export async function removeItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId); const item = itemIdSchema.safeParse(itemId); const version = expectedVersionSchema.safeParse(await json(request)); if (!collection.success || !item.success || !version.success) return respond(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient; const draft = await requireDraft(supabase, administrator.organizationId, collection.data); if (!draft) return respond(404, { ok: false, code: "not_found" }); if (draft.rowVersion !== version.data.expectedVersion) return respond(409, { ok: false, code: "stale_version" });
    const { data, error } = await supabase.from("collection_items").update({ removed_at: new Date().toISOString(), removed_by: administrator.userId, updated_by: administrator.userId }).eq("organization_id", administrator.organizationId).eq("collection_id", collection.data).eq("id", item.data).is("removed_at", null).select("id").maybeSingle(); if (error) return respond(500, { ok: false, code: "item_remove_failed" }); if (!data) return respond(404, { ok: false, code: "not_found" });
    const updatedDraft = await supabase.from("collections").update({ row_version: draft.rowVersion + 1, updated_by: administrator.userId }).eq("organization_id", administrator.organizationId).eq("id", draft.id).eq("status", "draft").eq("row_version", draft.rowVersion).select(draftColumns).maybeSingle(); const next = mapDraft(updatedDraft.data); if (updatedDraft.error || !next) return respond(409, { ok: false, code: "stale_version" }); return respond(200, { ok: true, data: { draft: next } });
  } catch (error: unknown) { return errorResponse(error); }
}

export async function uploadEvidence(request: Request, collectionId: string): Promise<NextResponse> {
  try {
    const id = collectionIdSchema.safeParse(collectionId); if (!id.success) return respond(400, { ok: false, code: "validation_error" }); const formData = await request.formData(); const itemId = formData.get("itemId"); const parsedItemId = itemId === null || itemId === "" ? null : itemIdSchema.safeParse(itemId); if (parsedItemId !== null && !parsedItemId.success) return respond(400, { ok: false, code: "validation_error" }); const fileValidation = await validateEvidenceFile(formData.get("file")); if (!fileValidation.valid) return respond(400, { ok: false, code: "invalid_file" }); const file = formData.get("file"); if (!(file instanceof File)) return respond(400, { ok: false, code: "invalid_file" });
    const administrator = await requireAuthenticatedAdministrator(); const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient; if (!await requireDraft(supabase, administrator.organizationId, id.data)) return respond(404, { ok: false, code: "not_found" }); const evidenceId = crypto.randomUUID(); const path = `${administrator.organizationId}/${id.data}/${evidenceId}.${fileValidation.extension}`; const upload = await supabase.storage.from("collection-evidences").upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) return respond(500, { ok: false, code: "evidence_upload_failed" });
    const { data, error } = await supabase.from("evidences").insert({ id: evidenceId, organization_id: administrator.organizationId, collection_id: id.data, collection_item_id: parsedItemId === null ? null : parsedItemId.data, storage_path: path, content_type: file.type, byte_size: file.size, sha256: fileValidation.sha256, created_by: administrator.userId }).select("id,collection_item_id,content_type,byte_size,created_at").maybeSingle(); const evidence = mapEvidence(data); if (error || !evidence) return respond(500, { ok: false, code: "evidence_record_failed" }); return respond(201, { ok: true, data: { evidence } });
  } catch (error: unknown) { return errorResponse(error); }
}
