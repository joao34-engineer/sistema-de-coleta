import "server-only";

import { z } from "zod";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { logTransactionFailure } from "@/shared/lib/server-logger";
import { createLifecycleSupabaseClient } from "./lifecycle-supabase";
import { lifecycleCommandResultSchema, signatureCommandResultSchema, type SignatureInput } from "../model/contracts";

async function digestSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestLifecycleRequest(operation: string, collectionId: string, expectedVersion: number, reason?: string): Promise<string> {
  const payload = JSON.stringify({ operation, collectionId, expectedVersion, reason: reason ?? null });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validatePngSignature(file: unknown): file is File {
  if (!(file instanceof File) || file.type !== "image/png" || file.size === 0 || file.size > 2 * 1024 * 1024) return false;
  return true;
}

const uploadIntentSchema = z.object({
  intentId: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
  storagePath: z.string().min(1).optional(),
  storage_path: z.string().min(1).optional(),
}).transform((value, context) => {
  const intentId = value.intentId ?? value.id;
  const storagePath = value.storagePath ?? value.storage_path;
  if (!intentId || !storagePath) {
    context.addIssue({ code: "custom", message: "upload_intent_contract_invalid" });
    return z.NEVER;
  }
  return { intentId, storagePath };
});

const signatureCommitSchema = z.object({
  collectionId: z.string().uuid().optional(),
  collection_id: z.string().uuid().optional(),
  signatureId: z.string().uuid().optional(),
  signature_id: z.string().uuid().optional(),
  rowVersion: z.number().int().positive().optional(),
  row_version: z.number().int().positive().optional(),
  signature: z.object({ id: z.string().uuid() }).optional(),
}).transform((value, context) => {
  const collectionId = value.collectionId ?? value.collection_id;
  const signatureId = value.signatureId ?? value.signature_id ?? value.signature?.id;
  const rowVersion = value.rowVersion ?? value.row_version;
  if (!collectionId || !signatureId || !rowVersion) {
    context.addIssue({ code: "custom", message: "signature_contract_invalid" });
    return z.NEVER;
  }
  return { collectionId, signatureId, rowVersion };
});

function isSafeStoragePath(value: string): boolean {
  return value.length <= 512 && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") && /^[A-Za-z0-9/_-]+\.png$/.test(value);
}

type SignatureCompensationResult = "canceled_and_removed" | "already_committed" | "failed";

function supabaseErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("message" in value)) return null;
  const message = value.message;
  return typeof message === "string" ? message : null;
}

async function compensateSignatureUpload(supabase: Awaited<ReturnType<typeof createLifecycleSupabaseClient>>, intentId: string, storagePath: string): Promise<SignatureCompensationResult> {
  let cancelError: unknown = null;
  try {
    const canceled = await supabase.rpc("cancel_collection_upload", { p_upload_intent_id: intentId });
    if (canceled.error) cancelError = canceled.error;
  } catch (error: unknown) {
    cancelError = error;
  }
  if (supabaseErrorMessage(cancelError) === "upload_already_committed") return "already_committed";
  if (cancelError) return "failed";
  try {
    const removed = await supabase.storage.from("collection-signatures").remove([storagePath]);
    return removed.error ? "failed" : "canceled_and_removed";
  } catch {
    // The canceled intent remains traceable for the cleanup worker.
    return "failed";
  }
}

export async function saveCollectionSignature(collectionId: string, input: SignatureInput, file: File, requestId?: string) {
  const administrator = await requireAuthenticatedAdministrator();
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length !== pngHeader.length || header.some((value, index) => value !== pngHeader[index])) throw new Error("invalid_signature_file");
  const supabase = await createLifecycleSupabaseClient();
  const fileSha256 = await digestSha256(file);
  let intentId: string | null = null;
  let storagePath: string | null = null;
  let commitSucceeded = false;
  try {
    const prepared = await supabase.rpc("prepare_collection_upload", {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_kind: "signature",
      p_item_id: null,
      p_content_type: "image/png",
      p_byte_size: file.size,
      p_sha256: fileSha256,
      p_extension: "png",
      p_signer_name: input.signerName,
      p_signer_tax_id: input.signerTaxId,
      p_acceptance_text: input.acceptanceText,
    });
    if (prepared.error) throw prepared.error;
    const intent = uploadIntentSchema.safeParse(prepared.data);
    if (!intent.success || !isSafeStoragePath(intent.data.storagePath)) throw new Error("upload_intent_contract_invalid");
    intentId = intent.data.intentId;
    storagePath = intent.data.storagePath;
    const upload = await supabase.storage.from("collection-signatures").upload(storagePath, file, { contentType: "image/png", upsert: false });
    if (upload.error) throw upload.error;
    const committed = await supabase.rpc("commit_collection_upload", { p_upload_intent_id: intentId, p_expected_version: input.expectedVersion });
    if (committed.error) throw committed.error;
    commitSucceeded = true;
    const normalized = signatureCommitSchema.safeParse(committed.data);
    if (!normalized.success) throw new Error("signature_contract_invalid");
    const parsed = signatureCommandResultSchema.safeParse(normalized.data);
    if (!parsed.success) throw new Error("signature_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    let compensation: SignatureCompensationResult | null = null;
    if (!commitSucceeded && intentId && storagePath) await compensateSignatureUpload(supabase, intentId, storagePath).then((value) => { compensation = value; });
    if (compensation === "failed" && requestId) logTransactionFailure({ requestId, operation: "save_collection_signature_compensation", code: "signature_compensation_failed", actorId: administrator.userId, status: 500 });
    if (requestId) logTransactionFailure({ requestId, operation: commitSucceeded ? "save_collection_signature_post_commit_response" : "save_collection_signature", code: commitSucceeded ? "signature_post_commit_response_failed" : "signature_upload_or_commit_failed", actorId: administrator.userId, status: 500 });
    throw error;
  }
}

async function executeLifecycleCommand(functionName: "finalize_collection" | "cancel_collection" | "reopen_collection", collectionId: string, expectedVersion: number, idempotencyKey: string, reason?: string) {
  await requireAuthenticatedAdministrator();
  const supabase = await createLifecycleSupabaseClient();
  const requestHash = await digestLifecycleRequest(functionName, collectionId, expectedVersion, reason);
  const baseArgs = { p_collection_id: collectionId, p_expected_version: expectedVersion, p_idempotency_key: idempotencyKey, p_request_hash: requestHash };
  const { data, error } = functionName === "finalize_collection"
    ? await supabase.rpc("finalize_collection", baseArgs)
    : functionName === "cancel_collection"
      ? await supabase.rpc("cancel_collection", { ...baseArgs, p_reason: reason ?? "" })
      : await supabase.rpc("reopen_collection", { ...baseArgs, p_reason: reason ?? "" });
  if (error) throw error;
  const parsed = lifecycleCommandResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("lifecycle_command_contract_invalid");
  return parsed.data;
}

export function finalizeCollection(collectionId: string, expectedVersion: number, idempotencyKey: string) { return executeLifecycleCommand("finalize_collection", collectionId, expectedVersion, idempotencyKey); }
export function cancelCollection(collectionId: string, expectedVersion: number, reason: string, idempotencyKey: string) { return executeLifecycleCommand("cancel_collection", collectionId, expectedVersion, idempotencyKey, reason); }
export function reopenCollection(collectionId: string, expectedVersion: number, reason: string, idempotencyKey: string) { return executeLifecycleCommand("reopen_collection", collectionId, expectedVersion, idempotencyKey, reason); }
