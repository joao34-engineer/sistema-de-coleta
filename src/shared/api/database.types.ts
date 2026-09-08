import type { Database as GeneratedDatabase, Json as GeneratedJson } from "./database.generated";

export type Json = GeneratedJson;

type PhaseOneTable<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type CustomerRow = { id: string; organization_id: number; legal_name: string; tax_id: string; phone: string; status: string; created_by: string; updated_by: string | null; created_at: string; updated_at: string };
export type CustomerContactRow = { id: string; organization_id: number; customer_id: string; full_name: string; phone: string | null; email: string | null; job_title: string | null; is_primary: boolean; created_by: string; created_at: string; updated_at: string };
export type CustomerAddressRow = { id: string; organization_id: number; customer_id: string; label: string | null; street: string; street_number: string | null; address_complement: string | null; district: string | null; city: string; state_code: string; postal_code: string | null; is_primary: boolean; created_by: string; created_at: string; updated_at: string };
export type VehicleRow = { id: string; organization_id: number; customer_id: string; plate: string | null; description: string | null; created_by: string; created_at: string; updated_at: string };
export type CollectionRow = { id: string; organization_id: number; customer_id: string | null; customer_snapshot: Json | null; status: string; official_code: string | null; issued_year: number | null; sequence_number: number | null; collection_location: string | null; responsible_name: string | null; responsible_tax_id: string | null; collected_at: string | null; row_version: number; canceled_at: string | null; canceled_by: string | null; cancel_reason: string | null; reopened_at: string | null; reopened_by: string | null; reopen_reason: string | null; previous_status_before_cancellation: string | null; check_in_signature_path: string | null; created_by: string; updated_by: string | null; created_at: string; updated_at: string };
export type CollectionItemRow = { id: string; organization_id: number; collection_id: string; description: string; quantity: number; condition_note: string | null; observation: string | null; position: number; removed_at: string | null; removed_by: string | null; created_by: string; updated_by: string | null; created_at: string; updated_at: string };
export type EvidenceRow = { id: string; organization_id: number; collection_id: string; collection_item_id: string | null; storage_path: string; content_type: string; byte_size: number; sha256: string | null; created_by: string; created_at: string };
export type SignatureRow = { id: string; organization_id: number; collection_id: string; signer_name: string; signer_tax_id: string; acceptance_text: string; storage_path: string; byte_size: number; sha256: string | null; created_by: string; signed_at: string; created_at: string };
export type CollectionSequenceRow = { organization_id: number; issued_year: number; last_value: number; updated_at: string };
export type CollectionEventRow = { id: string; organization_id: number; collection_id: string; actor_user_id: string | null; event_type: string; previous_status: string | null; new_status: string | null; reason: string | null; metadata: Json; created_at: string };
export type DocumentRow = { id: string; organization_id: number; collection_id: string; version: number; status: string; snapshot: Json; snapshot_hash: string; verification_token: string; storage_path: string | null; issuer_profile_id?: string | null; created_by: string; issued_at: string };
export type IdempotencyRequestRow = { id: string; organization_id: number; collection_id: string; operation: string; idempotency_key: string; request_hash: string; response: Json | null; completed_at: string | null; created_by: string; created_at: string };
export type OrganizationBrandAssetRow = { id: string; organization_id: number; asset_type: string; storage_path: string; content_type: string; byte_size: number; sha256: string; created_by: string; created_at: string };
export type DocumentIssuerProfileRow = { id: string; organization_id: number; legal_name: string; tax_id: string; phone: string; street: string; street_number: string; address_complement: string | null; district: string | null; city: string; state_code: string; postal_code: string; receipt_legal_text: string; signer_name: string; signer_title: string; logo_asset_id: string | null; status: string; template_version: string; profile_hash: string | null; created_by: string; created_at: string };
export type DocumentArtifactRow = { id: string; organization_id: number; document_id: string; artifact_type: string; storage_path: string; content_type: string; byte_size: number; sha256: string; created_by: string; created_at: string };
export type DocumentJobRow = { id: string; organization_id: number; document_id: string; job_type: string; status: string; idempotency_key: string; attempt_count: number; max_attempts: number; available_at: string; lease_token: string | null; leased_until: string | null; claimed_at: string | null; claimed_by: string | null; last_error_code: string | null; last_error_message: string | null; completed_at: string | null; requested_by: string; created_at: string };
export type DocumentRenderAttemptRow = { id: string; organization_id: number; job_id: string; document_id: string; attempt_number: number; status: string; worker_id: string; lease_token: string; artifact_id: string | null; error_code: string | null; error_message: string | null; started_at: string; completed_at: string | null; created_at: string };
export type DocumentShareRow = { id: string; organization_id: number; document_id: string; share_type: string; token_hash: string; max_downloads: number; download_count: number; expires_at: string; revoked_at: string | null; created_by: string; created_at: string };
export type ShareDeliveryRow = { id: string; organization_id: number; share_id: string; channel: string; recipient_masked: string | null; result: string; error_code: string | null; provider_reference: string | null; idempotency_hash: string | null; created_by: string; created_at: string };
export type DocumentRevisionRow = { id: string; organization_id: number; collection_id: string; previous_document_id: string; replacement_document_id: string; revision_type: string; reason: string; created_by: string; created_at: string };

type PhaseOneTables = {
  customers: PhaseOneTable<CustomerRow, Omit<CustomerRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by"> & { id?: string; status?: string; created_by?: string; updated_by?: string | null; created_at?: string; updated_at?: string }, Partial<CustomerRow>>;
  customer_contacts: PhaseOneTable<CustomerContactRow, Omit<CustomerContactRow, "id" | "created_at" | "updated_at" | "created_by"> & { id?: string; phone?: string | null; email?: string | null; job_title?: string | null; is_primary?: boolean; created_by?: string; created_at?: string; updated_at?: string }, Partial<CustomerContactRow>>;
  customer_addresses: PhaseOneTable<CustomerAddressRow, Omit<CustomerAddressRow, "id" | "created_at" | "updated_at" | "created_by" | "label" | "street_number" | "address_complement" | "district" | "postal_code" | "is_primary"> & { id?: string; label?: string | null; street_number?: string | null; address_complement?: string | null; district?: string | null; postal_code?: string | null; is_primary?: boolean; created_by?: string; created_at?: string; updated_at?: string }, Partial<CustomerAddressRow>>;
  vehicles: PhaseOneTable<VehicleRow, Omit<VehicleRow, "id" | "created_at" | "updated_at" | "created_by" | "plate" | "description"> & { id?: string; plate?: string | null; description?: string | null; created_by?: string; created_at?: string; updated_at?: string }, Partial<VehicleRow>>;
  collections: PhaseOneTable<CollectionRow, Omit<CollectionRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "customer_snapshot" | "status" | "official_code" | "issued_year" | "sequence_number" | "row_version" | "canceled_at" | "canceled_by" | "cancel_reason" | "reopened_at" | "reopened_by" | "reopen_reason" | "previous_status_before_cancellation" | "check_in_signature_path"> & { id?: string; customer_id?: string | null; customer_snapshot?: Json | null; collection_location?: string | null; responsible_name?: string | null; responsible_tax_id?: string | null; collected_at?: string | null; status?: string; official_code?: string | null; issued_year?: number | null; sequence_number?: number | null; row_version?: number; canceled_at?: string | null; canceled_by?: string | null; cancel_reason?: string | null; reopened_at?: string | null; reopened_by?: string | null; reopen_reason?: string | null; previous_status_before_cancellation?: string | null; check_in_signature_path?: string | null; created_by?: string; updated_by?: string | null; created_at?: string; updated_at?: string }, Partial<CollectionRow>>;
  collection_items: PhaseOneTable<CollectionItemRow, Omit<CollectionItemRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "condition_note" | "observation" | "position" | "removed_at" | "removed_by"> & { id?: string; condition_note?: string | null; observation?: string | null; position?: number; removed_at?: string | null; removed_by?: string | null; created_by?: string; updated_by?: string | null; created_at?: string; updated_at?: string }, Partial<CollectionItemRow>>;
  evidences: PhaseOneTable<EvidenceRow, Omit<EvidenceRow, "id" | "created_at" | "created_by" | "collection_item_id" | "sha256"> & { id?: string; collection_item_id?: string | null; sha256?: string | null; created_by?: string; created_at?: string }, Partial<EvidenceRow>>;
  signatures: PhaseOneTable<SignatureRow, Omit<SignatureRow, "id" | "created_at" | "created_by" | "signed_at" | "sha256"> & { id?: string; sha256?: string | null; created_by?: string; signed_at?: string; created_at?: string }, Partial<SignatureRow>>;
  collection_sequences: PhaseOneTable<CollectionSequenceRow, Omit<CollectionSequenceRow, "last_value" | "updated_at"> & { last_value?: number; updated_at?: string }, Partial<CollectionSequenceRow>>;
  collection_events: PhaseOneTable<CollectionEventRow, Omit<CollectionEventRow, "id" | "created_at" | "actor_user_id" | "previous_status" | "new_status" | "reason" | "metadata"> & { id?: string; actor_user_id?: string | null; previous_status?: string | null; new_status?: string | null; reason?: string | null; metadata?: Json; created_at?: string }, Partial<CollectionEventRow>>;
  documents: PhaseOneTable<DocumentRow, Omit<DocumentRow, "id" | "issued_at" | "status" | "storage_path"> & { id?: string; status?: string; storage_path?: string | null; issued_at?: string }, Partial<DocumentRow>>;
  idempotency_requests: PhaseOneTable<IdempotencyRequestRow, Omit<IdempotencyRequestRow, "id" | "created_at" | "response" | "completed_at"> & { id?: string; response?: Json | null; completed_at?: string | null; created_at?: string }, Partial<IdempotencyRequestRow>>;
};

type PhaseTwoTables = {
  organization_brand_assets: PhaseOneTable<OrganizationBrandAssetRow, Omit<OrganizationBrandAssetRow, "id" | "created_at"> & { id?: string; created_at?: string }, Partial<OrganizationBrandAssetRow>>;
  document_issuer_profiles: PhaseOneTable<DocumentIssuerProfileRow, Omit<DocumentIssuerProfileRow, "id" | "created_at"> & { id?: string; created_at?: string }, Partial<DocumentIssuerProfileRow>>;
  document_artifacts: PhaseOneTable<DocumentArtifactRow, Omit<DocumentArtifactRow, "id" | "created_at"> & { id?: string; created_at?: string }, Partial<DocumentArtifactRow>>;
  document_jobs: PhaseOneTable<DocumentJobRow, Omit<DocumentJobRow, "id" | "created_at" | "status" | "attempt_count" | "available_at" | "lease_token" | "leased_until" | "claimed_at" | "claimed_by" | "completed_at"> & { id?: string; status?: string; attempt_count?: number; available_at?: string; lease_token?: string | null; leased_until?: string | null; claimed_at?: string | null; claimed_by?: string | null; completed_at?: string | null; created_at?: string }, Partial<DocumentJobRow>>;
  document_render_attempts: PhaseOneTable<DocumentRenderAttemptRow, Omit<DocumentRenderAttemptRow, "id" | "created_at" | "status" | "completed_at"> & { id?: string; status?: string; completed_at?: string | null; created_at?: string }, Partial<DocumentRenderAttemptRow>>;
  document_shares: PhaseOneTable<DocumentShareRow, Omit<DocumentShareRow, "id" | "created_at" | "token_hash" | "revoked_at" | "download_count"> & { id?: string; token_hash?: string; revoked_at?: string | null; download_count?: number; created_at?: string }, Partial<DocumentShareRow>>;
  share_deliveries: PhaseOneTable<ShareDeliveryRow, Omit<ShareDeliveryRow, "id" | "created_at" | "idempotency_hash"> & { id?: string; idempotency_hash?: string | null; created_at?: string }, Partial<ShareDeliveryRow>>;
  document_revisions: PhaseOneTable<DocumentRevisionRow, Omit<DocumentRevisionRow, "id" | "created_at"> & { id?: string; created_at?: string }, Partial<DocumentRevisionRow>>;
};

type PhaseFunctionOverlays = {
  update_collection_draft: { Args: { p_collection_id: string; p_expected_version: number; p_patch: Json }; Returns: Json };
  create_collection_item: { Args: { p_collection_id: string; p_expected_version: number; p_description: string; p_quantity: number; p_condition_note?: string | null; p_observation?: string | null; p_position?: number; p_client_item_id?: string | null }; Returns: Json };
  update_collection_item: { Args: { p_collection_id: string; p_item_id: string; p_expected_version: number; p_patch: Json }; Returns: Json };
  remove_collection_item: { Args: { p_collection_id: string; p_item_id: string; p_expected_version: number }; Returns: Json };
  prepare_collection_upload: { Args: { p_collection_id: string; p_expected_version: number; p_kind: string; p_item_id: string | null; p_content_type: string; p_byte_size: number; p_sha256: string; p_extension?: string | null; p_signer_name?: string | null; p_signer_tax_id?: string | null; p_acceptance_text?: string | null }; Returns: Json };
  commit_collection_upload: { Args: { p_upload_intent_id: string; p_expected_version: number }; Returns: Json };
  cancel_collection_upload: { Args: { p_upload_intent_id: string }; Returns: Json };
  save_collection_signature: { Args: { p_collection_id: string; p_expected_version: number; p_signer_name: string; p_signer_tax_id: string; p_acceptance_text: string; p_storage_path: string; p_file_sha256: string; p_byte_size: number }; Returns: Json };
  finalize_collection: { Args: { p_collection_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  cancel_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  discard_collection_draft: { Args: { p_collection_id: string; p_expected_version: number }; Returns: Json };
  reopen_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  verify_collection_document: { Args: { p_verification_token: string }; Returns: { is_authentic: boolean; official_code: string; issued_at: string; collection_status: string; organization_name: string; document_version: number }[] };
  validate_document_issuer_profile: { Args: { p_organization_id: number; p_issuer_profile_id: string }; Returns: Json };
  save_company_issuer_settings: { Args: { p_legal_name: string; p_tax_id: string; p_phone: string; p_street: string; p_street_number: string; p_district: string; p_city: string; p_state_code: string; p_postal_code: string; p_receipt_legal_text: string; p_signer_name: string; p_signer_title: string; p_logo_asset_id?: string | null }; Returns: Json };
  consume_document_rate_limit: { Args: { p_scope: string; p_subject_hash: string; p_window_seconds: number; p_limit: number }; Returns: { allowed: boolean; retry_after_seconds: number }[] };
  claim_document_job: { Args: { p_worker_id: string; p_lease_seconds?: number }; Returns: Json };
  claim_document_job_for_document: { Args: { p_worker_id: string; p_lease_seconds: number; p_document_id: string }; Returns: Json };
  prepare_document_render_upload: { Args: { p_job_id: string; p_lease_token: string; p_artifact_type: string; p_content_type: string; p_byte_size: number; p_sha256: string }; Returns: Json };
  commit_document_render_upload: { Args: { p_intent_id: string }; Returns: Json };
  cancel_document_render_upload: { Args: { p_intent_id: string }; Returns: Json };
  cleanup_document_render_upload_intents: { Args: { p_limit?: number }; Returns: { intentId: string; storagePath: string; bucket: "collection-documents" }[] };
  ack_document_render_upload_cleanup: { Args: { p_intent_id: string }; Returns: Json };
  complete_document_job: { Args: { p_job_id: string; p_lease_token: string; p_status: string; p_artifact_id?: string | null; p_error_code?: string | null; p_error_message?: string | null }; Returns: Json };
  create_document_share: { Args: { p_document_id: string; p_share_type?: string; p_expires_at?: string | null; p_max_downloads?: number }; Returns: Json };
  revoke_document_share: { Args: { p_share_id: string }; Returns: Json };
  consume_document_share: { Args: { p_token: string }; Returns: Json };
  inspect_document_share: { Args: { p_token: string }; Returns: Json };
  retry_document_job: { Args: { p_collection_id: string; p_document_id: string; p_job_type?: string }; Returns: Json };
  reserve_document_share_email_delivery: { Args: { p_share_id: string; p_idempotency_hash: string; p_lease_seconds?: number }; Returns: Json };
  complete_document_share_email_delivery: { Args: { p_reservation_id: string; p_reservation_token: string; p_result: string; p_recipient_masked?: string | null; p_provider_reference?: string | null; p_error_code?: string | null }; Returns: Json };
  revise_collection_document: { Args: { p_source_document_id: string; p_expected_version: number; p_typed_document_patch: Json; p_revision_type: string; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
  create_document_revision: { Args: { p_previous_document_id: string; p_replacement_document_id: string; p_revision_type: string; p_reason: string }; Returns: Json };
  // PR 7 overlay until `npm run db:types:remote` after the migration is pushed.
  list_collections: {
    Args: {
      p_code?: string | null;
      p_customer?: string | null;
      p_tax_id?: string | null;
      p_phone?: string | null;
      p_status?: string | null;
      p_from?: string | null;
      p_to?: string | null;
      p_cursor?: string | null;
      p_limit?: number | null;
      p_q?: string | null;
      p_statuses?: string[] | null;
    };
    Returns: Json;
  };
  collection_dashboard_summary: {
    Args: { p_in_progress: string[]; p_ready_for_delivery: string[] };
    Returns: Json;
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Tables" | "Functions"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & PhaseOneTables & PhaseTwoTables;
    // Overlay wins for nullability under exactOptionalPropertyTypes; generated supplies the rest.
    Functions: Omit<GeneratedDatabase["public"]["Functions"], keyof PhaseFunctionOverlays> & PhaseFunctionOverlays;
  };
};
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["organization_memberships"]["Row"];
// Optional keeps pre-Phase-2 fixtures/rows source-compatible while the
// additive migration exposes logo_asset_id for new issuer snapshots.
export type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"] & { logo_asset_id?: string | null };
export type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
