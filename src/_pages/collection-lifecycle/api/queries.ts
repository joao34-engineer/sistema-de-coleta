import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { attachActorId } from "@/shared/lib/server-logger";
import { createLifecycleSupabaseClient } from "./lifecycle-supabase";
import { collectionDetailSchema, collectionEventsResultSchema, collectionListResultSchema, type CollectionDetailDTO, type CollectionListQuery } from "../model/contracts";

const lifecycleKeyAliases: Readonly<Record<string, string>> = {
  officialcode: "officialCode",
  customername: "customerName",
  customertaxid: "customerTaxId",
  customerphone: "customerPhone",
  taxid: "taxId",
  collectedat: "collectedAt",
  createdat: "createdAt",
  rowversion: "rowVersion",
  nextcursor: "nextCursor",
  collectionlocation: "collectionLocation",
  responsiblename: "responsibleName",
  signername: "signerName",
  signertaxid: "signerTaxId",
  acceptedat: "acceptedAt",
  itemid: "itemId",
  mimetype: "mimeType",
  contenttype: "contentType",
  byteSize: "byteSize",
  sizebytes: "sizeBytes",
  currentdocument: "currentDocument",
  issuedat: "issuedAt",
  previousstatus: "previousStatus",
  nextstatus: "nextStatus",
  actorname: "actorName",
};

function normalizeLifecyclePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeLifecyclePayload);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(Object.entries(record).map(([key, nested]) => [lifecycleKeyAliases[key] ?? key, normalizeLifecyclePayload(nested)]));
}

export async function listCollections(query: CollectionListQuery) {
  const administrator = await requireAuthenticatedAdministrator();
  try {
    const supabase = await createLifecycleSupabaseClient();
    const { data, error } = await supabase.rpc("list_collections", { p_code: query.code ?? null, p_customer: query.customer ?? null, p_tax_id: query.taxId ?? null, p_phone: query.phone ?? null, p_status: query.status ?? null, p_from: query.from ?? null, p_to: query.to ?? null, p_cursor: query.cursor ?? null, p_limit: query.limit });
    if (error) throw error;
    const parsed = collectionListResultSchema.safeParse(normalizeLifecyclePayload(data));
    if (!parsed.success) throw new Error("collection_list_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    throw attachActorId(error, administrator.userId);
  }
}

export async function getCollectionDetail(collectionId: string): Promise<CollectionDetailDTO | null> {
  const administrator = await requireAuthenticatedAdministrator();
  try {
    const supabase = await createLifecycleSupabaseClient();
    const { data, error } = await supabase.rpc("get_collection_detail", { p_collection_id: collectionId });
    if (error) throw error;
    if (data == null) return null;
    const parsed = collectionDetailSchema.safeParse(normalizeLifecyclePayload(data));
    if (!parsed.success) throw new Error("collection_detail_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    throw attachActorId(error, administrator.userId);
  }
}

export async function getCollectionEvents(collectionId: string, cursor: string | null, limit: number) {
  const administrator = await requireAuthenticatedAdministrator();
  try {
    const supabase = await createLifecycleSupabaseClient();
    const { data, error } = await supabase.rpc("list_collection_events", { p_collection_id: collectionId, p_cursor: cursor, p_limit: limit });
    if (error) throw error;
    const parsed = collectionEventsResultSchema.safeParse(normalizeLifecyclePayload(data));
    if (!parsed.success) throw new Error("collection_events_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    throw attachActorId(error, administrator.userId);
  }
}
