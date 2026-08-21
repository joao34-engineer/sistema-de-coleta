import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createPhaseTwoServiceClient } from "../rendering/server-client";
import { getPublicEnvironment } from "@/shared/config/environment";
import { sha256Hex } from "../rendering/canonical-json";
import { toSupabaseJson } from "../rendering/server-client";
import { documentShareCreatedSchema, documentRevisionResultSchema, type ShareCreateInput, type RevisionInput } from "./contracts";
import { matchesDocumentShareTokenHash } from "./share-token";
import { documentRateLimitRules, enforceDocumentRateLimit } from "./rate-limit.server";

export const DOCUMENT_SHARE_MAX_DOWNLOADS = 20;
export const DOCUMENT_SHARE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

export function documentShareExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + DOCUMENT_SHARE_EXPIRATION_MS).toISOString();
}

export async function createDocumentShare(documentId: string, input: ShareCreateInput) {
  const administrator = await requireAuthenticatedAdministrator();
  await enforceDocumentRateLimit(documentRateLimitRules.shareCreate, `administrator:${administrator.userId}`);
  if (!getPublicEnvironment().appUrl) throw new Error("document_share_base_url_missing");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_document_share", {
    p_document_id: documentId,
    p_share_type: input.shareType,
    p_expires_at: documentShareExpiresAt(),
    p_max_downloads: DOCUMENT_SHARE_MAX_DOWNLOADS,
  });
  if (error) throw error;
  return documentShareCreatedSchema.parse(data);
}

export async function revokeDocumentShare(shareId: string) {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("revoke_document_share", { p_share_id: shareId });
  if (error) throw error;
  return data;
}

export async function reviseCollectionDocument(input: RevisionInput, idempotencyKey: string) {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const requestHash = sha256Hex(JSON.stringify({ sourceDocumentId: input.sourceDocumentId, expectedVersion: input.expectedVersion, typedDocumentPatch: input.typedDocumentPatch, revisionType: input.revisionType, reason: input.reason }));
  const { data, error } = await supabase.rpc("revise_collection_document", {
    p_source_document_id: input.sourceDocumentId,
    p_expected_version: input.expectedVersion,
    p_typed_document_patch: toSupabaseJson(input.typedDocumentPatch),
    p_revision_type: input.revisionType,
    p_reason: input.reason,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  });
  if (error) throw error;
  return documentRevisionResultSchema.parse(data);
}

/** Compatibility helper for callers that still need to inspect the legacy RPC. */
export async function createDocumentRevision(input: Readonly<{ previousDocumentId: string; replacementDocumentId: string; revisionType: "correction" | "reissue" | "reopen"; reason: string }>) {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_document_revision", { p_previous_document_id: input.previousDocumentId, p_replacement_document_id: input.replacementDocumentId, p_revision_type: input.revisionType, p_reason: input.reason });
  if (error) throw error;
  return data;
}

export type ShareAuthorization = Readonly<{ shareId: string; organizationId: number; documentId: string; createdBy: string }>;

const emailDeliverySchema = z.object({
  id: z.uuid(),
  shareId: z.uuid(),
  channel: z.literal("email"),
  result: z.enum(["queued", "sent", "failed"]),
  recipientMasked: z.string().nullable(),
  providerReference: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
}).strict();

const emailDeliveryReservationSchema = z.object({
  reservationId: z.uuid(),
  reservationToken: z.uuid().nullable(),
  canSend: z.boolean(),
  status: z.enum(["reserved", "queued", "sent", "failed"]),
  deliveryId: z.uuid().nullable(),
  delivery: emailDeliverySchema.nullable(),
}).strict();

const completedEmailDeliverySchema = z.object({
  reservationId: z.uuid(),
  deliveryId: z.uuid(),
  status: z.enum(["queued", "sent", "failed"]),
  providerReference: z.string().nullable(),
}).strict();

export type EmailDelivery = z.output<typeof emailDeliverySchema>;
export type EmailDeliveryReservation = z.output<typeof emailDeliveryReservationSchema>;
export type CompletedEmailDelivery = z.output<typeof completedEmailDeliverySchema>;

export async function authorizeShareForEmail(shareId: string, expectedDocumentId: string | undefined, expectedToken: string): Promise<ShareAuthorization> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("document_shares").select("id,organization_id,document_id,created_by,token_hash").eq("id", shareId).maybeSingle();
  if (error) throw error;
  if (!data || data.organization_id !== administrator.organizationId || (expectedDocumentId !== undefined && data.document_id !== expectedDocumentId) || !matchesDocumentShareTokenHash(expectedToken, data.token_hash)) throw new Error("document_share_not_found");
  return { shareId: data.id, organizationId: data.organization_id, documentId: data.document_id, createdBy: administrator.userId };
}

export async function reserveDocumentShareEmailDelivery(shareId: string, idempotencyKey: string): Promise<EmailDeliveryReservation> {
  const service = createPhaseTwoServiceClient();
  const { data, error } = await service.rpc("reserve_document_share_email_delivery", {
    p_share_id: shareId,
    p_idempotency_hash: sha256Hex(idempotencyKey),
    p_lease_seconds: 300,
  });
  if (error) throw error;
  return emailDeliveryReservationSchema.parse(data);
}

export async function completeDocumentShareEmailDelivery(input: Readonly<{
  reservationId: string;
  reservationToken: string;
  result: "queued" | "sent" | "failed";
  recipientMasked: string | null;
  providerReference: string | null;
  errorCode: string | null;
}>): Promise<CompletedEmailDelivery> {
  const service = createPhaseTwoServiceClient();
  const { data, error } = await service.rpc("complete_document_share_email_delivery", {
    p_reservation_id: input.reservationId,
    p_reservation_token: input.reservationToken,
    p_result: input.result,
    p_recipient_masked: input.recipientMasked,
    p_provider_reference: input.providerReference,
    p_error_code: input.errorCode,
  });
  if (error) throw error;
  return completedEmailDeliverySchema.parse(data);
}

export async function findEmailDelivery(shareId: string, idempotencyKey: string) {
  const service = createPhaseTwoServiceClient();
  const { data, error } = await service.from("share_deliveries").select("id,share_id,channel,result,recipient_masked,provider_reference,created_at").eq("share_id", shareId).eq("channel", "email").like("provider_reference", `%${idempotencyKey}`).maybeSingle();
  if (error) throw error;
  return data;
}

export async function recordEmailDelivery(input: Readonly<{ shareId: string; organizationId: number; recipientMasked: string; providerReference: string; createdBy: string }>) {
  const service = createPhaseTwoServiceClient();
  const { data, error } = await service.from("share_deliveries").insert({ share_id: input.shareId, organization_id: input.organizationId, channel: "email", recipient_masked: input.recipientMasked, result: "queued", error_code: null, provider_reference: input.providerReference, created_by: input.createdBy }).select("id,share_id,channel,result,recipient_masked,provider_reference,created_at").single();
  if (error) throw error;
  return data;
}
