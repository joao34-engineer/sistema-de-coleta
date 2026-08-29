import "server-only";

import { z } from "zod";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { attachActorId, logTransactionFailure } from "@/shared/lib/server-logger";
import { createOperationsSupabaseClient } from "./operations-supabase";
import {
  WorkshopCheckInDTO,
  TechnicalBudgetDTO,
  BudgetApprovalDTO,
  ServiceProgressDTO,
  InvoiceReferenceDTO,
  CustomerDeliveryDTO,
  CancelReopenDTO,
  workshopCheckInResultSchema,
  technicalBudgetResultSchema,
  budgetApprovalResultSchema,
  serviceProgressResultSchema,
  invoiceReferenceResultSchema,
  customerDeliveryResultSchema,
  cancelReopenResultSchema,
} from "../model/contracts";

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

type RpcArgs = Record<string, unknown>;

async function executePhase3Command<T extends z.ZodTypeAny>(
  functionName: "workshop_check_in" | "create_technical_budget" | "approve_technical_budget" | "update_service_progress" | "register_invoice_reference" | "deliver_to_customer" | "cancel_or_reopen_collection",
  rpcArgs: RpcArgs,
  resultSchema: T,
  idempotencyKey: string,
  reason?: string
): Promise<z.infer<T>> {
  const administrator = await requireAuthenticatedAdministrator();
  try {
    const supabase = await createOperationsSupabaseClient();
    const requestHash = await digestLifecycleRequest(
      functionName,
      (rpcArgs["p_collection_id"] as string) ?? "",
      (rpcArgs["p_expected_version"] as number) ?? 0,
      reason
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;
    const { data, error } = await rpc(functionName, { ...rpcArgs, p_idempotency_key: idempotencyKey, p_request_hash: requestHash });
    if (error) throw error;
    const parsed = resultSchema.safeParse(data);
    if (!parsed.success) throw new Error("operations_command_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    throw attachActorId(error, administrator.userId);
  }
}

export async function workshopCheckIn(
  collectionId: string,
  input: WorkshopCheckInDTO,
  file: File,
  requestId?: string
) {
  const administrator = await requireAuthenticatedAdministrator();
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length !== pngHeader.length || header.some((value, index) => value !== pngHeader[index])) throw new Error("invalid_signature_file");
  const supabase = await createOperationsSupabaseClient();
  const fileSha256 = await digestSha256(file);
  let intentId: string | null = null;
  let storagePath: string | null = null;
  let commitSucceeded = false;
  try {
    const prepared = await supabase.rpc("prepare_delivery_signature_intent", {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_kind: "workshop_check_in",
      p_signer_name: input.administratorName,
      p_signer_tax_id: input.administratorTaxId,
      p_acceptance_text: "Check-in de oficina confirmado.",
      p_sha256: fileSha256,
      p_byte_size: file.size,
    });
    if (prepared.error) throw prepared.error;
    const intentResult = z.object({ intentId: z.string().uuid(), storagePath: z.string() }).safeParse(prepared.data);
    if (!intentResult.success) throw new Error("upload_intent_contract_invalid");
    intentId = intentResult.data.intentId;
    storagePath = intentResult.data.storagePath;
    const upload = await supabase.storage.from("collection-signatures").upload(storagePath, file, { contentType: "image/png", upsert: false });
    if (upload.error) throw upload.error;
    const committed = await supabase.rpc("commit_delivery_signature_intent", { p_intent_id: intentId, p_expected_version: input.expectedVersion });
    if (committed.error) throw committed.error;
    commitSucceeded = true;
  } catch (error: unknown) {
    if (!commitSucceeded && intentId && storagePath) {
      let cancelError: unknown = null;
      try {
        const canceled = await supabase.rpc("cancel_delivery_signature_intent", { p_intent_id: intentId });
        if (canceled.error) cancelError = canceled.error;
      } catch (e: unknown) {
        cancelError = e;
      }
      if (cancelError && typeof cancelError === "object" && cancelError !== null && "message" in cancelError && (cancelError as { message?: unknown }).message === "upload_already_committed") {
        // já committed, ok
      } else if (!commitSucceeded) {
        try {
          await supabase.storage.from("collection-signatures").remove([storagePath]);
        } catch { /* cleanup best-effort */ }
      }
    }
    if (requestId) logTransactionFailure({ requestId, operation: commitSucceeded ? "workshop_checkin_post_commit" : "workshop_checkin", code: commitSucceeded ? "post_commit_response_failed" : "upload_or_commit_failed", actorId: administrator.userId, status: 500 });
    throw attachActorId(error, administrator.userId);
  }
  return executePhase3Command(
    "workshop_check_in",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_administrator_name: input.administratorName,
      p_administrator_tax_id: input.administratorTaxId,
      p_items: input.items,
      p_signature_intent_id: intentId,
    },
    workshopCheckInResultSchema,
    input.signatureIntentId
  );
}

export async function saveTechnicalBudget(
  collectionId: string,
  input: TechnicalBudgetDTO,
  idempotencyKey: string
) {
  return executePhase3Command(
    "create_technical_budget",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_items: input.items,
      p_general_notes: input.generalNotes ?? null,
    },
    technicalBudgetResultSchema,
    idempotencyKey
  );
}

export async function budgetApproval(
  collectionId: string,
  input: BudgetApprovalDTO,
  idempotencyKey: string
) {
  return executePhase3Command(
    "approve_technical_budget",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_approved: input.approved,
      p_rejection_reason: input.rejectionReason ?? null,
      p_signer_name: input.signerName,
      p_signer_tax_id: input.signerTaxId,
    },
    budgetApprovalResultSchema,
    idempotencyKey
  );
}

export async function serviceProgress(
  collectionId: string,
  input: ServiceProgressDTO,
  idempotencyKey: string
) {
  return executePhase3Command(
    "update_service_progress",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_items: input.items,
    },
    serviceProgressResultSchema,
    idempotencyKey
  );
}

export async function registerInvoiceReference(
  collectionId: string,
  input: InvoiceReferenceDTO,
  idempotencyKey: string
) {
  return executePhase3Command(
    "register_invoice_reference",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_number: input.number,
      p_series: input.series,
      p_issued_at: input.issuedAt,
      p_total_brl: input.totalBrl,
      p_notes: input.notes ?? null,
    },
    invoiceReferenceResultSchema,
    idempotencyKey
  );
}

export async function deliverToCustomer(
  collectionId: string,
  input: CustomerDeliveryDTO,
  file: File,
  requestId?: string
) {
  const administrator = await requireAuthenticatedAdministrator();
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (header.length !== pngHeader.length || header.some((value, index) => value !== pngHeader[index])) throw new Error("invalid_signature_file");
  const supabase = await createOperationsSupabaseClient();
  const fileSha256 = await digestSha256(file);
  let intentId: string | null = null;
  let storagePath: string | null = null;
  let commitSucceeded = false;
  try {
    const prepared = await supabase.rpc("prepare_delivery_signature_intent", {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_kind: "delivery_term",
      p_signer_name: input.receiverName,
      p_signer_tax_id: input.receiverTaxId,
      p_acceptance_text: "Entrega dos equipamentos confirmada.",
      p_sha256: fileSha256,
      p_byte_size: file.size,
    });
    if (prepared.error) throw prepared.error;
    const intentResult = z.object({ intentId: z.string().uuid(), storagePath: z.string() }).safeParse(prepared.data);
    if (!intentResult.success) throw new Error("upload_intent_contract_invalid");
    intentId = intentResult.data.intentId;
    storagePath = intentResult.data.storagePath;
    const upload = await supabase.storage.from("collection-signatures").upload(storagePath, file, { contentType: "image/png", upsert: false });
    if (upload.error) throw upload.error;
    const committed = await supabase.rpc("commit_delivery_signature_intent", { p_intent_id: intentId, p_expected_version: input.expectedVersion });
    if (committed.error) throw committed.error;
    commitSucceeded = true;
  } catch (error: unknown) {
    if (!commitSucceeded && intentId && storagePath) {
      let cancelError: unknown = null;
      try {
        const canceled = await supabase.rpc("cancel_delivery_signature_intent", { p_intent_id: intentId });
        if (canceled.error) cancelError = canceled.error;
      } catch (e: unknown) {
        cancelError = e;
      }
      if (cancelError && typeof cancelError === "object" && cancelError !== null && "message" in cancelError && (cancelError as { message?: unknown }).message === "upload_already_committed") {
        // já committed, ok
      } else if (!commitSucceeded) {
        try {
          await supabase.storage.from("collection-signatures").remove([storagePath]);
        } catch { /* cleanup best-effort */ }
      }
    }
    if (requestId) logTransactionFailure({ requestId, operation: commitSucceeded ? "delivery_post_commit" : "delivery", code: commitSucceeded ? "post_commit_response_failed" : "upload_or_commit_failed", actorId: administrator.userId, status: 500 });
    throw attachActorId(error, administrator.userId);
  }
  return executePhase3Command(
    "deliver_to_customer",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_delivered_item_ids: input.deliveredItemIds,
      p_receiver_name: input.receiverName,
      p_receiver_tax_id: input.receiverTaxId,
      p_notes: input.notes ?? null,
      p_signature_intent_id: intentId,
    },
    customerDeliveryResultSchema,
    input.signatureIntentId
  );
}

export async function cancelOrReopenCollection(
  collectionId: string,
  input: CancelReopenDTO,
  idempotencyKey: string
) {
  return executePhase3Command(
    "cancel_or_reopen_collection",
    {
      p_collection_id: collectionId,
      p_expected_version: input.expectedVersion,
      p_action: input.action,
      p_reason: input.reason,
    },
    cancelReopenResultSchema,
    idempotencyKey
  );
}
