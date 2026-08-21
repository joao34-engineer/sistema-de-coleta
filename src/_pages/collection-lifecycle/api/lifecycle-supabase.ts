import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Json } from "@/shared/api/database.types";
import { getPublicEnvironment } from "@/shared/config/environment";

type LifecycleFunctions = {
  list_collections: { Args: { p_code: string | null; p_customer: string | null; p_tax_id: string | null; p_phone: string | null; p_status: string | null; p_from: string | null; p_to: string | null; p_cursor: string | null; p_limit: number }; Returns: Json };
  get_collection_detail: { Args: { p_collection_id: string }; Returns: Json };
  list_collection_events: { Args: { p_collection_id: string; p_cursor: string | null; p_limit: number }; Returns: Json };
  prepare_collection_upload: { Args: { p_collection_id: string; p_expected_version: number; p_kind: string; p_item_id: string | null; p_content_type: string; p_byte_size: number; p_sha256: string; p_extension: string; p_signer_name?: string | null; p_signer_tax_id?: string | null; p_acceptance_text?: string | null }; Returns: Json };
  commit_collection_upload: { Args: { p_upload_intent_id: string; p_expected_version: number }; Returns: Json };
  cancel_collection_upload: { Args: { p_upload_intent_id: string }; Returns: Json };
  update_collection_draft: { Args: { p_collection_id: string; p_expected_version: number; p_patch: Json }; Returns: Json };
  finalize_collection: { Args: { p_collection_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  cancel_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  reopen_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
};

type LifecycleDatabase = { public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: LifecycleFunctions; Enums: Record<never, never>; CompositeTypes: Record<never, never> } };

export async function createLifecycleSupabaseClient() {
  const environment = getPublicEnvironment();
  const cookieStore = await cookies();
  return createServerClient<LifecycleDatabase>(environment.supabaseUrl, environment.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Route handlers can always set cookies; safe fallback for non-mutation contexts. */ } },
    },
  });
}
