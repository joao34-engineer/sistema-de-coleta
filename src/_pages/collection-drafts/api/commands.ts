import "server-only";

import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { toActionFailureCode } from "@/shared/lib/action-failure-code";
import { validateEvidenceFile } from "@/shared/lib/file/file-validation";
import { attachActorId, getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import {
  collectionIdSchema,
  draftCreateSchema,
  draftPatchSchema,
  itemCreateCommandSchema,
  itemPatchCommandSchema,
  type DraftDTO,
  type DraftItemDTO,
  type EvidenceDTO,
} from "../model/draft";
import {
  cancelUpload,
  createPhaseOneClient,
  databaseErrorCode,
  databaseErrorMessage,
  draftColumns,
  isSafeStoragePath,
  loadDraft,
  loadEvidence,
  loadItem,
  mapDraft,
  mutationEvidenceId,
  mutationItemId,
  mutationRowVersion,
  uploadCommitSchema,
  uploadIntentSchema,
  type PhaseOneClient,
  type UploadCompensationResult,
} from "./draft-db";

type DraftCreateInput = z.infer<typeof draftCreateSchema>;
type DraftPatchInput = z.infer<typeof draftPatchSchema>;
type ItemCreateInput = z.infer<typeof itemCreateCommandSchema>;
type ItemPatchInput = z.infer<typeof itemPatchCommandSchema>;

function fail(code: string, actorId: string): never {
  throw attachActorId(new Error(code), actorId);
}

function throwRpc(error: unknown, actorId: string): never {
  throw attachActorId(error, actorId);
}

export async function createDraft(input: DraftCreateInput): Promise<Readonly<{ draft: DraftDTO; idempotent: boolean }>> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const existing = await supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", input.id).maybeSingle();
  if (existing.error) fail("draft_query_failed", administrator.userId);
  const previous = mapDraft(existing.data);
  if (previous) return { draft: previous, idempotent: true };
  const { data, error } = await supabase.from("collections").insert({ id: input.id, organization_id: administrator.organizationId, customer_id: input.customerId ?? null, status: "draft", created_by: administrator.userId, updated_by: administrator.userId }).select(draftColumns).maybeSingle();
  if (error && databaseErrorCode(error) === "23505") {
    const replay = await supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", input.id).maybeSingle();
    const replayed = replay.error ? null : mapDraft(replay.data);
    if (replayed) return { draft: replayed, idempotent: true };
  }
  const draft = mapDraft(data);
  if (error || !draft) fail("draft_create_conflict", administrator.userId);
  await supabase.from("collection_events").insert({ organization_id: administrator.organizationId, collection_id: draft.id, actor_user_id: administrator.userId, event_type: "collection.draft.created", metadata: {} });
  return { draft, idempotent: false };
}

export async function patchDraft(id: string, input: DraftPatchInput): Promise<DraftDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const { error } = await supabase.rpc("update_collection_draft", {
    p_collection_id: id,
    p_expected_version: input.expectedVersion,
    p_patch: {
      ...(input.customerId === undefined ? {} : { customer_id: input.customerId }),
      ...(input.collectionLocation === undefined ? {} : { collection_location: input.collectionLocation }),
      ...(input.responsibleName === undefined ? {} : { responsible_name: input.responsibleName }),
      ...(input.responsibleTaxId === undefined ? {} : { responsible_tax_id: input.responsibleTaxId }),
      ...(input.collectedAt === undefined ? {} : { collected_at: input.collectedAt }),
    },
  });
  if (error) throwRpc(error, administrator.userId);
  const draft = await loadDraft(supabase, id);
  if (!draft) fail("draft_update_contract_invalid", administrator.userId);
  return draft;
}

export async function addItem(collectionId: string, input: ItemCreateInput): Promise<Readonly<{ item: DraftItemDTO; draft: DraftDTO; rowVersion: number }>> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase.rpc("create_collection_item", {
    p_collection_id: collectionId,
    p_expected_version: input.expectedVersion,
    p_description: input.description,
    p_quantity: input.quantity,
    p_condition_note: input.condition ?? null,
    p_observation: input.notes ?? null,
    p_client_item_id: input.clientItemId ?? null,
  });
  if (error) throwRpc(error, administrator.userId);
  const itemId = mutationItemId(data) ?? input.clientItemId ?? null;
  const created = itemId ? await loadItem(supabase, collectionId, itemId) : null;
  const draft = await loadDraft(supabase, collectionId);
  if (!created || !draft || mutationRowVersion(data) !== draft.rowVersion) fail("item_create_contract_invalid", administrator.userId);
  return { item: created, draft, rowVersion: draft.rowVersion };
}

export async function patchItem(
  collectionId: string,
  itemId: string,
  input: ItemPatchInput,
): Promise<Readonly<{ item: DraftItemDTO; draft: DraftDTO; rowVersion: number }>> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase.rpc("update_collection_item", {
    p_collection_id: collectionId,
    p_item_id: itemId,
    p_expected_version: input.expectedVersion,
    p_patch: {
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      ...(input.condition === undefined ? {} : { condition_note: input.condition }),
      ...(input.notes === undefined ? {} : { observation: input.notes }),
    },
  });
  if (error) throwRpc(error, administrator.userId);
  const updated = await loadItem(supabase, collectionId, itemId);
  const draft = await loadDraft(supabase, collectionId);
  if (!updated || !draft || mutationRowVersion(data) !== draft.rowVersion) fail("item_update_contract_invalid", administrator.userId);
  return { item: updated, draft, rowVersion: draft.rowVersion };
}

export async function removeItem(
  collectionId: string,
  itemId: string,
  expectedVersion: number,
): Promise<Readonly<{ draft: DraftDTO; rowVersion: number }>> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase.rpc("remove_collection_item", {
    p_collection_id: collectionId,
    p_item_id: itemId,
    p_expected_version: expectedVersion,
  });
  if (error) throwRpc(error, administrator.userId);
  const draft = await loadDraft(supabase, collectionId);
  if (!draft || mutationRowVersion(data) !== draft.rowVersion) fail("item_remove_contract_invalid", administrator.userId);
  return { draft, rowVersion: draft.rowVersion };
}

export async function uploadEvidence(
  collectionId: string,
  file: File,
  input: Readonly<{ expectedVersion: number; itemId: string | null }>,
  requestId?: string,
): Promise<Readonly<{ evidence: EvidenceDTO; rowVersion: number }>> {
  let intentId: string | null = null;
  let storagePath: string | null = null;
  let actorId: string | null = null;
  let supabase: PhaseOneClient | null = null;
  let commitSucceeded = false;
  const resolvedRequestId = requestId ?? getRequestId();
  try {
    const fileValidation = await validateEvidenceFile(file);
    if (!fileValidation.valid) {
      throw new Error("invalid_file");
    }
    const administrator = await requireAuthenticatedAdministrator();
    actorId = administrator.userId;
    supabase = await createPhaseOneClient();
    const prepared = await supabase.rpc("prepare_collection_upload", {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_kind: "evidence",
      p_item_id: input.itemId,
      p_content_type: file.type,
      p_byte_size: file.size,
      p_sha256: fileValidation.sha256,
      p_extension: fileValidation.extension,
    });
    if (prepared.error) throwRpc(prepared.error, administrator.userId);
    const intent = uploadIntentSchema.safeParse(prepared.data);
    if (!intent.success || !isSafeStoragePath(intent.data.storagePath)) {
      fail("evidence_prepare_contract_invalid", administrator.userId);
    }
    intentId = intent.data.intentId;
    storagePath = intent.data.storagePath;
    const upload = await supabase.storage.from("collection-evidences").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) fail("evidence_upload_failed", administrator.userId);
    const committed = await supabase.rpc("commit_collection_upload", { p_upload_intent_id: intentId, p_expected_version: input.expectedVersion });
    if (committed.error) throwRpc(committed.error, administrator.userId);
    commitSucceeded = true;
    const commit = uploadCommitSchema.safeParse(committed.data);
    const evidenceId = mutationEvidenceId(committed.data);
    const evidence = commit.success && evidenceId ? await loadEvidence(supabase, collectionId, evidenceId) : null;
    if (!commit.success || !evidence || !evidenceId) {
      fail("evidence_commit_contract_invalid", administrator.userId);
    }
    return { evidence, rowVersion: commit.data.rowVersion };
  } catch (error: unknown) {
    let compensation: UploadCompensationResult | null = null;
    if (!commitSucceeded && intentId && storagePath && supabase) await cancelUpload(supabase, intentId, storagePath).then((value) => { compensation = value; });
    if (compensation === "failed") {
      logTransactionFailure({ requestId: resolvedRequestId, operation: "evidence_upload_compensation", code: "evidence_compensation_failed", actorId, status: 500 });
    } else if (commitSucceeded) {
      logTransactionFailure({ requestId: resolvedRequestId, operation: "evidence_post_commit_response", code: "evidence_post_commit_response_failed", actorId, status: 500 });
    }
    throw error;
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
    const supabase = await createPhaseOneClient();
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
