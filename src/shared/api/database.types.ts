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
export type CollectionRow = { id: string; organization_id: number; customer_id: string | null; status: string; official_code: string | null; issued_year: number | null; sequence_number: number | null; collection_location: string | null; responsible_name: string | null; responsible_tax_id: string | null; collected_at: string | null; row_version: number; canceled_at: string | null; canceled_by: string | null; cancel_reason: string | null; reopened_at: string | null; reopened_by: string | null; reopen_reason: string | null; previous_status_before_cancellation: string | null; created_by: string; updated_by: string | null; created_at: string; updated_at: string };
export type CollectionItemRow = { id: string; organization_id: number; collection_id: string; description: string; quantity: number; condition_note: string | null; observation: string | null; position: number; removed_at: string | null; removed_by: string | null; created_by: string; created_at: string; updated_at: string };
export type EvidenceRow = { id: string; organization_id: number; collection_id: string; collection_item_id: string | null; storage_path: string; content_type: string; byte_size: number; sha256: string | null; created_by: string; created_at: string };
export type SignatureRow = { id: string; organization_id: number; collection_id: string; signer_name: string; signer_tax_id: string; acceptance_text: string; storage_path: string; byte_size: number; sha256: string | null; created_by: string; signed_at: string; created_at: string };
export type CollectionSequenceRow = { organization_id: number; issued_year: number; last_value: number; updated_at: string };
export type CollectionEventRow = { id: string; organization_id: number; collection_id: string; actor_user_id: string | null; event_type: string; previous_status: string | null; new_status: string | null; reason: string | null; metadata: Json; created_at: string };
export type DocumentRow = { id: string; organization_id: number; collection_id: string; version: number; status: string; snapshot: Json; snapshot_hash: string; verification_token: string; storage_path: string | null; created_by: string; issued_at: string };
export type IdempotencyRequestRow = { id: string; organization_id: number; collection_id: string; operation: string; idempotency_key: string; request_hash: string; response: Json | null; completed_at: string | null; created_by: string; created_at: string };

type PhaseOneTables = {
  customers: PhaseOneTable<CustomerRow, Omit<CustomerRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by"> & { id?: string; status?: string; created_by?: string; updated_by?: string | null; created_at?: string; updated_at?: string }, Partial<CustomerRow>>;
  customer_contacts: PhaseOneTable<CustomerContactRow, Omit<CustomerContactRow, "id" | "created_at" | "updated_at" | "created_by"> & { id?: string; phone?: string | null; email?: string | null; job_title?: string | null; is_primary?: boolean; created_by?: string; created_at?: string; updated_at?: string }, Partial<CustomerContactRow>>;
  customer_addresses: PhaseOneTable<CustomerAddressRow, Omit<CustomerAddressRow, "id" | "created_at" | "updated_at" | "created_by" | "label" | "street_number" | "address_complement" | "district" | "postal_code" | "is_primary"> & { id?: string; label?: string | null; street_number?: string | null; address_complement?: string | null; district?: string | null; postal_code?: string | null; is_primary?: boolean; created_by?: string; created_at?: string; updated_at?: string }, Partial<CustomerAddressRow>>;
  vehicles: PhaseOneTable<VehicleRow, Omit<VehicleRow, "id" | "created_at" | "updated_at" | "created_by" | "plate" | "description"> & { id?: string; plate?: string | null; description?: string | null; created_by?: string; created_at?: string; updated_at?: string }, Partial<VehicleRow>>;
  collections: PhaseOneTable<CollectionRow, Omit<CollectionRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "status" | "official_code" | "issued_year" | "sequence_number" | "row_version" | "canceled_at" | "canceled_by" | "cancel_reason" | "reopened_at" | "reopened_by" | "reopen_reason" | "previous_status_before_cancellation"> & { id?: string; customer_id?: string | null; collection_location?: string | null; responsible_name?: string | null; responsible_tax_id?: string | null; collected_at?: string | null; status?: string; official_code?: string | null; issued_year?: number | null; sequence_number?: number | null; row_version?: number; canceled_at?: string | null; canceled_by?: string | null; cancel_reason?: string | null; reopened_at?: string | null; reopened_by?: string | null; reopen_reason?: string | null; previous_status_before_cancellation?: string | null; created_by?: string; updated_by?: string | null; created_at?: string; updated_at?: string }, Partial<CollectionRow>>;
  collection_items: PhaseOneTable<CollectionItemRow, Omit<CollectionItemRow, "id" | "created_at" | "updated_at" | "created_by" | "condition_note" | "observation" | "position" | "removed_at" | "removed_by"> & { id?: string; condition_note?: string | null; observation?: string | null; position?: number; removed_at?: string | null; removed_by?: string | null; created_by?: string; created_at?: string; updated_at?: string }, Partial<CollectionItemRow>>;
  evidences: PhaseOneTable<EvidenceRow, Omit<EvidenceRow, "id" | "created_at" | "created_by" | "collection_item_id" | "sha256"> & { id?: string; collection_item_id?: string | null; sha256?: string | null; created_by?: string; created_at?: string }, Partial<EvidenceRow>>;
  signatures: PhaseOneTable<SignatureRow, Omit<SignatureRow, "id" | "created_at" | "created_by" | "signed_at" | "sha256"> & { id?: string; sha256?: string | null; created_by?: string; signed_at?: string; created_at?: string }, Partial<SignatureRow>>;
  collection_sequences: PhaseOneTable<CollectionSequenceRow, Omit<CollectionSequenceRow, "last_value" | "updated_at"> & { last_value?: number; updated_at?: string }, Partial<CollectionSequenceRow>>;
  collection_events: PhaseOneTable<CollectionEventRow, Omit<CollectionEventRow, "id" | "created_at" | "actor_user_id" | "previous_status" | "new_status" | "reason" | "metadata"> & { id?: string; actor_user_id?: string | null; previous_status?: string | null; new_status?: string | null; reason?: string | null; metadata?: Json; created_at?: string }, Partial<CollectionEventRow>>;
  documents: PhaseOneTable<DocumentRow, Omit<DocumentRow, "id" | "issued_at" | "status" | "storage_path"> & { id?: string; status?: string; storage_path?: string | null; issued_at?: string }, Partial<DocumentRow>>;
  idempotency_requests: PhaseOneTable<IdempotencyRequestRow, Omit<IdempotencyRequestRow, "id" | "created_at" | "response" | "completed_at"> & { id?: string; response?: Json | null; completed_at?: string | null; created_at?: string }, Partial<IdempotencyRequestRow>>;
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Tables" | "Functions"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & PhaseOneTables;
    Functions: GeneratedDatabase["public"]["Functions"] & {
      save_collection_signature: { Args: { p_collection_id: string; p_expected_version: number; p_signer_name: string; p_signer_tax_id: string; p_acceptance_text: string; p_storage_path: string; p_file_sha256: string; p_byte_size: number }; Returns: Json };
      finalize_collection: { Args: { p_collection_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
      cancel_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
      reopen_collection: { Args: { p_collection_id: string; p_expected_version: number; p_reason: string; p_idempotency_key: string; p_request_hash: string }; Returns: Json };
      verify_collection_document: { Args: { p_verification_token: string }; Returns: { is_authentic: boolean; official_code: string; issued_at: string; collection_status: string; organization_name: string; document_version: number }[] };
    };
  };
};
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["organization_memberships"]["Row"];
export type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];
export type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
