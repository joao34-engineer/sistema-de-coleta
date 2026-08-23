import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Json } from "@/shared/api/database.types";
import { getPublicEnvironment } from "@/shared/config/environment";

type OperationsFunctions = {
  prepare_delivery_signature_intent: { Args: { p_collection_id: string; p_expected_version: number; p_kind: string; p_signer_name: string; p_signer_tax_id: string; p_acceptance_text: string; p_sha256: string; p_byte_size: number }; Returns: Json };
  commit_delivery_signature_intent: { Args: { p_intent_id: string; p_expected_version: number }; Returns: Json };
  cancel_delivery_signature_intent: { Args: { p_intent_id: string }; Returns: Json };
  workshop_check_in: { Args: { p_collection_id: string; p_expected_version: number; p_administrator_name: string; p_administrator_tax_id: string; p_items: Json; p_signature_intent_id: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  create_technical_budget: { Args: { p_collection_id: string; p_expected_version: number; p_items: Json; p_general_notes: string | null; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  approve_technical_budget: { Args: { p_collection_id: string; p_expected_version: number; p_approved: boolean; p_rejection_reason: string | null; p_signer_name: string; p_signer_tax_id: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  update_service_progress: { Args: { p_collection_id: string; p_expected_version: number; p_items: Json; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  register_invoice_reference: { Args: { p_collection_id: string; p_expected_version: number; p_number: string; p_series: string; p_issued_at: string; p_total_brl: number; p_notes: string | null; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  deliver_to_customer: { Args: { p_collection_id: string; p_expected_version: number; p_delivered_item_ids: string[]; p_receiver_name: string; p_receiver_tax_id: string; p_notes: string | null; p_signature_intent_id: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  cancel_or_reopen_collection: { Args: { p_collection_id: string; p_expected_version: number; p_action: string; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
};

type OperationsTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type OperationsTables = {
  service_orders: OperationsTable;
  service_order_items: OperationsTable;
  invoice_references: OperationsTable;
  delivery_terms: OperationsTable;
  delivery_term_items: OperationsTable;
  workshop_checkin_items: OperationsTable;
};

type OperationsDatabase = {
  public: {
    Tables: OperationsTables;
    Views: Record<never, never>;
    Functions: OperationsFunctions;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export async function createOperationsSupabaseClient() {
  const environment = getPublicEnvironment();
  const cookieStore = await cookies();
  return createServerClient<OperationsDatabase>(environment.supabaseUrl, environment.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Safe fallback for non-mutation contexts.
        }
      },
    },
  });
}
