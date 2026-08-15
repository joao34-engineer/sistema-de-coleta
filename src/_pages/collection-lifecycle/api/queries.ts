import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createLifecycleSupabaseClient } from "./lifecycle-supabase";
import { collectionDetailSchema, collectionEventsResultSchema, collectionListResultSchema, type CollectionDetailDTO, type CollectionListQuery } from "../model/contracts";

export async function listCollections(query: CollectionListQuery) {
  await requireAuthenticatedAdministrator();
  const supabase = await createLifecycleSupabaseClient();
  const { data, error } = await supabase.rpc("list_collections", { p_code: query.code ?? null, p_customer: query.customer ?? null, p_tax_id: query.taxId ?? null, p_phone: query.phone ?? null, p_status: query.status ?? null, p_from: query.from ?? null, p_to: query.to ?? null, p_cursor: query.cursor ?? null, p_limit: query.limit });
  if (error) throw error;
  const parsed = collectionListResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("collection_list_contract_invalid");
  return parsed.data;
}

export async function getCollectionDetail(collectionId: string): Promise<CollectionDetailDTO> {
  await requireAuthenticatedAdministrator();
  const supabase = await createLifecycleSupabaseClient();
  const { data, error } = await supabase.rpc("get_collection_detail", { p_collection_id: collectionId });
  if (error) throw error;
  const parsed = collectionDetailSchema.safeParse(data);
  if (!parsed.success) throw new Error("collection_detail_contract_invalid");
  return parsed.data;
}

export async function getCollectionEvents(collectionId: string, cursor: string | null, limit: number) {
  await requireAuthenticatedAdministrator();
  const supabase = await createLifecycleSupabaseClient();
  const { data, error } = await supabase.rpc("list_collection_events", { p_collection_id: collectionId, p_cursor: cursor, p_limit: limit });
  if (error) throw error;
  const parsed = collectionEventsResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("collection_events_contract_invalid");
  return parsed.data;
}
