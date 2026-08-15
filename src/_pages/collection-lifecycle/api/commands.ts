import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
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

export async function saveCollectionSignature(collectionId: string, input: SignatureInput, file: File) {
  const administrator = await requireAuthenticatedAdministrator();
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length !== pngHeader.length || header.some((value, index) => value !== pngHeader[index])) throw new Error("invalid_signature_file");
  const supabase = await createLifecycleSupabaseClient();
  const path = `${administrator.organizationId}/${collectionId}/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await supabase.storage.from("collection-signatures").upload(path, file, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.rpc("save_collection_signature", { p_collection_id: collectionId, p_expected_version: input.expectedVersion, p_signer_name: input.signerName, p_signer_tax_id: input.signerTaxId, p_acceptance_text: input.acceptanceText, p_storage_path: path, p_file_sha256: await digestSha256(file), p_byte_size: file.size });
  if (error) throw error;
  const parsed = signatureCommandResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("signature_contract_invalid");
  return parsed.data;
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
