export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: number
          metadata: Json
          organization_id: number
          subject_id: string
          subject_type: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          organization_id: number
          subject_id: string
          subject_type: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          organization_id?: number
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_events: {
        Row: {
          actor_user_id: string | null
          collection_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_status: string | null
          organization_id: number
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          collection_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_status?: string | null
          organization_id: number
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          collection_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_status?: string | null
          organization_id?: number
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_events_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "collection_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          client_item_id: string | null
          collection_id: string
          condition_note: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          observation: string | null
          organization_id: number
          position: number
          quantity: number
          removed_at: string | null
          removed_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_item_id?: string | null
          collection_id: string
          condition_note?: string | null
          created_at?: string
          created_by?: string
          description: string
          id?: string
          observation?: string | null
          organization_id: number
          position?: number
          quantity: number
          removed_at?: string | null
          removed_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_item_id?: string | null
          collection_id?: string
          condition_note?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          observation?: string | null
          organization_id?: number
          position?: number
          quantity?: number
          removed_at?: string | null
          removed_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "collection_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collection_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collection_sequences: {
        Row: {
          issued_year: number
          last_value: number
          organization_id: number
          updated_at: string
        }
        Insert: {
          issued_year: number
          last_value?: number
          organization_id: number
          updated_at?: string
        }
        Update: {
          issued_year?: number
          last_value?: number
          organization_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          check_in_signature_path: string | null
          collected_at: string | null
          collection_location: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_snapshot: Json | null
          id: string
          issued_year: number | null
          official_code: string | null
          organization_id: number
          previous_status_before_cancellation: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          responsible_name: string | null
          responsible_tax_id: string | null
          row_version: number
          sequence_number: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          check_in_signature_path?: string | null
          collected_at?: string | null
          collection_location?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_snapshot?: Json | null
          id?: string
          issued_year?: number | null
          official_code?: string | null
          organization_id: number
          previous_status_before_cancellation?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          responsible_name?: string | null
          responsible_tax_id?: string | null
          row_version?: number
          sequence_number?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          check_in_signature_path?: string | null
          collected_at?: string | null
          collection_location?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_snapshot?: Json | null
          id?: string
          issued_year?: number | null
          official_code?: string | null
          organization_id?: number
          previous_status_before_cancellation?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          responsible_name?: string | null
          responsible_tax_id?: string | null
          row_version?: number
          sequence_number?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collections_customer_id_organization_id_fkey"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_complement: string | null
          city: string
          created_at: string
          created_by: string
          customer_id: string
          district: string | null
          id: string
          is_primary: boolean
          label: string | null
          organization_id: number
          postal_code: string | null
          state_code: string
          street: string
          street_number: string | null
          updated_at: string
        }
        Insert: {
          address_complement?: string | null
          city: string
          created_at?: string
          created_by?: string
          customer_id: string
          district?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          organization_id: number
          postal_code?: string | null
          state_code: string
          street: string
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          address_complement?: string | null
          city?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          district?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          organization_id?: number
          postal_code?: string | null
          state_code?: string
          street?: string
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_organization_id_fkey"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "customer_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          job_title: string | null
          organization_id: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          customer_id: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          organization_id: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          organization_id?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_organization_id_fkey"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "customer_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          legal_name: string
          organization_id: number
          phone: string
          status: string
          tax_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          legal_name: string
          organization_id: number
          phone: string
          status?: string
          tax_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          legal_name?: string
          organization_id?: number
          phone?: string
          status?: string
          tax_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          collection_id: string
          collection_item_id: string
          created_at: string
          id: string
          organization_id: number
          quantity: number
        }
        Insert: {
          collection_id: string
          collection_item_id: string
          created_at?: string
          id?: string
          organization_id: number
          quantity: number
        }
        Update: {
          collection_id?: string
          collection_item_id?: string
          created_at?: string
          id?: string
          organization_id?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_items_collection_item_id_collection_id_organizati_fkey"
            columns: ["collection_item_id", "collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collection_items"
            referencedColumns: ["id", "collection_id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_term_items: {
        Row: {
          collection_id: string
          collection_item_id: string
          created_at: string
          delivery_term_id: string
          id: string
          organization_id: number
          quantity: number
        }
        Insert: {
          collection_id: string
          collection_item_id: string
          created_at?: string
          delivery_term_id: string
          id?: string
          organization_id: number
          quantity: number
        }
        Update: {
          collection_id?: string
          collection_item_id?: string
          created_at?: string
          delivery_term_id?: string
          id?: string
          organization_id?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_term_items_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_term_items_collection_item_id_collection_id_organ_fkey"
            columns: ["collection_item_id", "collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collection_items"
            referencedColumns: ["id", "collection_id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_term_items_delivery_term_id_fkey"
            columns: ["delivery_term_id"]
            isOneToOne: false
            referencedRelation: "delivery_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_term_items_delivery_term_id_organization_id_fkey"
            columns: ["delivery_term_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "delivery_terms"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_term_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_terms: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: number
          receiver_name: string
          receiver_tax_id: string
          service_order_id: string | null
          signature_path: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: number
          receiver_name: string
          receiver_tax_id: string
          service_order_id?: string | null
          signature_path: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: number
          receiver_name?: string
          receiver_tax_id?: string
          service_order_id?: string | null
          signature_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_terms_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "delivery_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "delivery_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_terms_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_artifacts: {
        Row: {
          artifact_type: string
          byte_size: number
          content_type: string
          created_at: string
          created_by: string
          document_id: string
          id: string
          organization_id: number
          sha256: string
          storage_path: string
        }
        Insert: {
          artifact_type: string
          byte_size: number
          content_type: string
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          organization_id: number
          sha256: string
          storage_path: string
        }
        Update: {
          artifact_type?: string
          byte_size?: number
          content_type?: string
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          organization_id?: number
          sha256?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_artifacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_artifacts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_artifacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_issuer_profiles: {
        Row: {
          address_complement: string | null
          city: string
          created_at: string
          created_by: string
          district: string | null
          id: string
          legal_name: string
          logo_asset_id: string | null
          organization_id: number
          phone: string
          postal_code: string
          profile_hash: string | null
          receipt_legal_text: string
          signer_name: string
          signer_title: string
          state_code: string
          status: string
          street: string
          street_number: string
          tax_id: string
          template_version: string
        }
        Insert: {
          address_complement?: string | null
          city: string
          created_at?: string
          created_by: string
          district?: string | null
          id?: string
          legal_name: string
          logo_asset_id?: string | null
          organization_id: number
          phone: string
          postal_code: string
          profile_hash?: string | null
          receipt_legal_text: string
          signer_name: string
          signer_title: string
          state_code: string
          status?: string
          street: string
          street_number: string
          tax_id: string
          template_version?: string
        }
        Update: {
          address_complement?: string | null
          city?: string
          created_at?: string
          created_by?: string
          district?: string | null
          id?: string
          legal_name?: string
          logo_asset_id?: string | null
          organization_id?: number
          phone?: string
          postal_code?: string
          profile_hash?: string | null
          receipt_legal_text?: string
          signer_name?: string
          signer_title?: string
          state_code?: string
          status?: string
          street?: string
          street_number?: string
          tax_id?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_issuer_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_issuer_profiles_logo_asset_id_fkey"
            columns: ["logo_asset_id"]
            isOneToOne: false
            referencedRelation: "organization_brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_issuer_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          document_id: string
          id: string
          idempotency_key: string
          job_type: string
          last_error_code: string | null
          last_error_message: string | null
          lease_token: string | null
          leased_until: string | null
          max_attempts: number
          organization_id: number
          requested_by: string
          status: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          id?: string
          idempotency_key: string
          job_type: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_token?: string | null
          leased_until?: string | null
          max_attempts?: number
          organization_id: number
          requested_by: string
          status?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          id?: string
          idempotency_key?: string
          job_type?: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_token?: string | null
          leased_until?: string | null
          max_attempts?: number
          organization_id?: number
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      document_render_attempts: {
        Row: {
          artifact_id: string | null
          attempt_number: number
          completed_at: string | null
          created_at: string
          document_id: string
          error_code: string | null
          error_message: string | null
          id: string
          job_id: string
          lease_token: string
          organization_id: number
          started_at: string
          status: string
          worker_id: string
        }
        Insert: {
          artifact_id?: string | null
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          lease_token: string
          organization_id: number
          started_at?: string
          status: string
          worker_id: string
        }
        Update: {
          artifact_id?: string | null
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          lease_token?: string
          organization_id?: number
          started_at?: string
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_render_attempts_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_attempts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "document_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_revisions: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string
          id: string
          organization_id: number
          previous_document_id: string
          reason: string
          replacement_document_id: string
          revision_type: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: number
          previous_document_id: string
          reason: string
          replacement_document_id: string
          revision_type: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: number
          previous_document_id?: string
          reason?: string
          replacement_document_id?: string
          revision_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_revisions_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "document_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_revisions_previous_document_id_fkey"
            columns: ["previous_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_revisions_replacement_document_id_fkey"
            columns: ["replacement_document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          download_count: number
          expires_at: string
          id: string
          max_downloads: number
          organization_id: number
          revoked_at: string | null
          share_type: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          organization_id: number
          revoked_at?: string | null
          share_type?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          organization_id?: number
          revoked_at?: string | null
          share_type?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          collection_id: string
          created_by: string
          id: string
          issued_at: string
          issuer_profile_id: string | null
          organization_id: number
          snapshot: Json
          snapshot_hash: string
          status: string
          storage_path: string | null
          verification_token: string
          version: number
        }
        Insert: {
          collection_id: string
          created_by: string
          id?: string
          issued_at?: string
          issuer_profile_id?: string | null
          organization_id: number
          snapshot: Json
          snapshot_hash: string
          status?: string
          storage_path?: string | null
          verification_token: string
          version: number
        }
        Update: {
          collection_id?: string
          created_by?: string
          id?: string
          issued_at?: string
          issuer_profile_id?: string | null
          organization_id?: number
          snapshot?: Json
          snapshot_hash?: string
          status?: string
          storage_path?: string | null
          verification_token?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_issuer_profile_id_fkey"
            columns: ["issuer_profile_id"]
            isOneToOne: false
            referencedRelation: "document_issuer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          byte_size: number
          collection_id: string
          collection_item_id: string | null
          content_type: string
          created_at: string
          created_by: string
          id: string
          organization_id: number
          sha256: string | null
          storage_path: string
        }
        Insert: {
          byte_size: number
          collection_id: string
          collection_item_id?: string | null
          content_type: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id: number
          sha256?: string | null
          storage_path: string
        }
        Update: {
          byte_size?: number
          collection_id?: string
          collection_item_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: number
          sha256?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidences_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "evidences_collection_item_id_collection_id_organization_id_fkey"
            columns: ["collection_item_id", "collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collection_items"
            referencedColumns: ["id", "collection_id", "organization_id"]
          },
          {
            foreignKeyName: "evidences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "evidences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_requests: {
        Row: {
          collection_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          operation: string
          organization_id: number
          request_hash: string
          response: Json | null
        }
        Insert: {
          collection_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          operation: string
          organization_id: number
          request_hash: string
          response?: Json | null
        }
        Update: {
          collection_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          operation?: string
          organization_id?: number
          request_hash?: string
          response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_requests_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "idempotency_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "idempotency_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_references: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string
          id: string
          issued_at: string
          notes: string | null
          number: string
          organization_id: number
          series: string
          total_brl: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at: string
          notes?: string | null
          number: string
          organization_id: number
          series: string
          total_brl: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          organization_id?: number
          series?: string
          total_brl?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_references_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "invoice_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_references_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_brand_assets: {
        Row: {
          asset_type: string
          byte_size: number
          content_type: string
          created_at: string
          created_by: string
          id: string
          organization_id: number
          sha256: string
          storage_path: string
        }
        Insert: {
          asset_type: string
          byte_size: number
          content_type: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: number
          sha256: string
          storage_path: string
        }
        Update: {
          asset_type?: string
          byte_size?: number
          content_type?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: number
          sha256?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_brand_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_brand_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: number
          organization_id: number
          role_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          organization_id: number
          role_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          organization_id?: number
          role_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          address_complement: string | null
          city: string | null
          created_at: string
          district: string | null
          legal_name: string | null
          logo_asset_id: string | null
          logo_path: string | null
          organization_id: number
          phone: string | null
          postal_code: string | null
          receipt_legal_text: string | null
          setup_complete: boolean | null
          signer_name: string | null
          signer_title: string | null
          state_code: string | null
          street: string | null
          street_number: string | null
          tax_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_complement?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          legal_name?: string | null
          logo_asset_id?: string | null
          logo_path?: string | null
          organization_id: number
          phone?: string | null
          postal_code?: string | null
          receipt_legal_text?: string | null
          setup_complete?: boolean | null
          signer_name?: string | null
          signer_title?: string | null
          state_code?: string | null
          street?: string | null
          street_number?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_complement?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          legal_name?: string | null
          logo_asset_id?: string | null
          logo_path?: string | null
          organization_id?: number
          phone?: string | null
          postal_code?: string | null
          receipt_legal_text?: string | null
          setup_complete?: boolean | null
          signer_name?: string | null
          signer_title?: string | null
          state_code?: string | null
          street?: string | null
          street_number?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_logo_asset_id_fkey"
            columns: ["logo_asset_id"]
            isOneToOne: false
            referencedRelation: "organization_brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: never
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: never
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          code: string
          created_at: string
          display_name: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
        }
        Relationships: []
      }
      service_order_items: {
        Row: {
          collection_id: string
          collection_item_id: string | null
          created_at: string
          estimated_days: number
          id: string
          labor_cost_brl: number
          notes: string | null
          organization_id: number
          parts_cost_brl: number
          status: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          collection_item_id?: string | null
          created_at?: string
          estimated_days: number
          id?: string
          labor_cost_brl: number
          notes?: string | null
          organization_id: number
          parts_cost_brl: number
          status?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          collection_item_id?: string | null
          created_at?: string
          estimated_days?: number
          id?: string
          labor_cost_brl?: number
          notes?: string | null
          organization_id?: number
          parts_cost_brl?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "service_order_items_collection_item_id_collection_id_organ_fkey"
            columns: ["collection_item_id", "collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collection_items"
            referencedColumns: ["id", "collection_id", "organization_id"]
          },
          {
            foreignKeyName: "service_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          administrator_id: string
          approval_signer_name: string | null
          approval_signer_tax_id: string | null
          check_in_signature_path: string | null
          collection_id: string
          created_at: string
          due_days: number
          id: string
          labor_brl: number
          organization_id: number
          parts_brl: number
          previous_status_before_cancellation: string | null
          status: string
          updated_at: string
        }
        Insert: {
          administrator_id: string
          approval_signer_name?: string | null
          approval_signer_tax_id?: string | null
          check_in_signature_path?: string | null
          collection_id: string
          created_at?: string
          due_days: number
          id?: string
          labor_brl: number
          organization_id: number
          parts_brl: number
          previous_status_before_cancellation?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          administrator_id?: string
          approval_signer_name?: string | null
          approval_signer_tax_id?: string | null
          check_in_signature_path?: string | null
          collection_id?: string
          created_at?: string
          due_days?: number
          id?: string
          labor_brl?: number
          organization_id?: number
          parts_brl?: number
          previous_status_before_cancellation?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_administrator_id_fkey"
            columns: ["administrator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_orders_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "service_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      share_deliveries: {
        Row: {
          channel: string
          created_at: string
          created_by: string
          error_code: string | null
          id: string
          idempotency_hash: string | null
          organization_id: number
          provider_reference: string | null
          recipient_masked: string | null
          result: string
          share_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by: string
          error_code?: string | null
          id?: string
          idempotency_hash?: string | null
          organization_id: number
          provider_reference?: string | null
          recipient_masked?: string | null
          result: string
          share_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string
          error_code?: string | null
          id?: string
          idempotency_hash?: string | null
          organization_id?: number
          provider_reference?: string | null
          recipient_masked?: string | null
          result?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "share_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_deliveries_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "document_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          acceptance_text: string
          byte_size: number
          collection_id: string
          created_at: string
          created_by: string
          id: string
          organization_id: number
          sha256: string | null
          signed_at: string
          signer_name: string
          signer_tax_id: string
          storage_path: string
        }
        Insert: {
          acceptance_text: string
          byte_size: number
          collection_id: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id: number
          sha256?: string | null
          signed_at?: string
          signer_name: string
          signer_tax_id: string
          storage_path: string
        }
        Update: {
          acceptance_text?: string
          byte_size?: number
          collection_id?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: number
          sha256?: string | null
          signed_at?: string
          signer_name?: string
          signer_tax_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "signatures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          id: string
          organization_id: number
          plate: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          customer_id: string
          description?: string | null
          id?: string
          organization_id: number
          plate?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          id?: string
          organization_id?: number
          plate?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_organization_id_fkey"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_checkin_items: {
        Row: {
          arrival_status: string
          collection_id: string
          collection_item_id: string
          condition_observed: string
          created_at: string
          divergence_notes: string | null
          id: string
          organization_id: number
          quantity_observed: number
        }
        Insert: {
          arrival_status?: string
          collection_id: string
          collection_item_id: string
          condition_observed: string
          created_at?: string
          divergence_notes?: string | null
          id?: string
          organization_id: number
          quantity_observed: number
        }
        Update: {
          arrival_status?: string
          collection_id?: string
          collection_item_id?: string
          condition_observed?: string
          created_at?: string
          divergence_notes?: string | null
          id?: string
          organization_id?: number
          quantity_observed?: number
        }
        Relationships: [
          {
            foreignKeyName: "workshop_checkin_items_collection_id_organization_id_fkey"
            columns: ["collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "workshop_checkin_items_collection_item_id_collection_id_or_fkey"
            columns: ["collection_item_id", "collection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "collection_items"
            referencedColumns: ["id", "collection_id", "organization_id"]
          },
          {
            foreignKeyName: "workshop_checkin_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_collection_upload_cleanup: {
        Args: { p_intent_id: string }
        Returns: boolean
      }
      ack_document_render_upload_cleanup: {
        Args: { p_intent_id: string }
        Returns: Json
      }
      approve_technical_budget: {
        Args: {
          p_approved: boolean
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_rejection_reason: string
          p_request_hash: string
          p_signer_name: string
          p_signer_tax_id: string
        }
        Returns: Json
      }
      cancel_collection: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_reason: string
          p_request_hash: string
        }
        Returns: Json
      }
      cancel_collection_upload: {
        Args: { p_upload_intent_id: string }
        Returns: Json
      }
      cancel_delivery_signature_intent: {
        Args: { p_intent_id: string }
        Returns: Json
      }
      cancel_document_render_upload: {
        Args: { p_intent_id: string }
        Returns: Json
      }
      cancel_or_reopen_collection: {
        Args: {
          p_action: string
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_reason: string
          p_request_hash: string
        }
        Returns: Json
      }
      claim_document_job: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_document_job_for_document: {
        Args: {
          p_document_id: string
          p_lease_seconds: number
          p_worker_id: string
        }
        Returns: Json
      }
      cleanup_document_render_upload_intents: {
        Args: { p_limit?: number }
        Returns: Json
      }
      collection_dashboard_summary: {
        Args: { p_in_progress: string[]; p_ready_for_delivery: string[] }
        Returns: Json
      }
      commit_collection_upload: {
        Args: { p_expected_version: number; p_upload_intent_id: string }
        Returns: Json
      }
      commit_delivery_signature_intent: {
        Args: { p_expected_version: number; p_intent_id: string }
        Returns: Json
      }
      commit_document_render_upload: {
        Args: { p_intent_id: string }
        Returns: Json
      }
      complete_document_job: {
        Args: {
          p_artifact_id?: string
          p_error_code?: string
          p_error_message?: string
          p_job_id: string
          p_lease_token: string
          p_status: string
        }
        Returns: Json
      }
      complete_document_share_email_delivery: {
        Args: {
          p_error_code?: string
          p_provider_reference?: string
          p_recipient_masked?: string
          p_reservation_id: string
          p_reservation_token: string
          p_result: string
        }
        Returns: Json
      }
      consume_document_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      consume_document_share: { Args: { p_token: string }; Returns: Json }
      create_collection_item: {
        Args: {
          p_client_item_id?: string
          p_collection_id: string
          p_condition_note?: string
          p_description: string
          p_expected_version: number
          p_observation?: string
          p_position?: number
          p_quantity: number
        }
        Returns: Json
      }
      create_customer_with_address: {
        Args: {
          p_address: Json
          p_legal_name: string
          p_phone: string
          p_tax_id: string
        }
        Returns: Json
      }
      create_customer_with_address_for_organization: {
        Args: {
          p_address: Json
          p_legal_name: string
          p_organization_id: number
          p_phone: string
          p_tax_id: string
        }
        Returns: Json
      }
      create_document_revision: {
        Args: {
          p_previous_document_id: string
          p_reason: string
          p_replacement_document_id: string
          p_revision_type: string
        }
        Returns: Json
      }
      create_document_share: {
        Args: {
          p_document_id: string
          p_expires_at?: string
          p_max_downloads?: number
          p_share_type?: string
        }
        Returns: Json
      }
      create_technical_budget: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_general_notes: string
          p_idempotency_key: string
          p_items: Json
          p_request_hash: string
        }
        Returns: Json
      }
      deliver_to_customer: {
        Args: {
          p_collection_id: string
          p_delivered_item_ids: string[]
          p_expected_version: number
          p_idempotency_key: string
          p_notes: string
          p_receiver_name: string
          p_receiver_tax_id: string
          p_request_hash: string
          p_signature_intent_id: string
        }
        Returns: Json
      }
      discard_collection_draft: {
        Args: { p_collection_id: string; p_expected_version: number }
        Returns: Json
      }
      expire_collection_upload_intents: {
        Args: { p_limit?: number }
        Returns: {
          bucket_id: string
          intent_id: string
          kind: string
          status: string
          storage_path: string
        }[]
      }
      finalize_collection: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_request_hash: string
        }
        Returns: Json
      }
      get_collection_detail: {
        Args: { p_collection_id: string }
        Returns: Json
      }
      inspect_document_share: { Args: { p_token: string }; Returns: Json }
      list_collection_events: {
        Args: { p_collection_id: string; p_cursor: string; p_limit: number }
        Returns: Json
      }
      list_collections: {
        Args: {
          p_code?: string
          p_cursor?: string
          p_customer?: string
          p_from?: string
          p_limit?: number
          p_phone?: string
          p_q?: string
          p_status?: string
          p_statuses?: string[]
          p_tax_id?: string
          p_to?: string
        }
        Returns: Json
      }
      peek_document_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      prepare_collection_upload: {
        Args: {
          p_acceptance_text?: string
          p_byte_size: number
          p_collection_id: string
          p_content_type: string
          p_expected_version: number
          p_extension?: string
          p_item_id: string
          p_kind: string
          p_sha256: string
          p_signer_name?: string
          p_signer_tax_id?: string
        }
        Returns: Json
      }
      prepare_delivery_signature_intent: {
        Args: {
          p_acceptance_text: string
          p_byte_size: number
          p_collection_id: string
          p_expected_version: number
          p_kind: string
          p_sha256: string
          p_signer_name: string
          p_signer_tax_id: string
        }
        Returns: Json
      }
      prepare_document_render_upload: {
        Args: {
          p_artifact_type: string
          p_byte_size: number
          p_content_type: string
          p_job_id: string
          p_lease_token: string
          p_sha256: string
        }
        Returns: Json
      }
      register_invoice_reference: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_issued_at: string
          p_notes: string
          p_number: string
          p_request_hash: string
          p_series: string
          p_total_brl: number
        }
        Returns: Json
      }
      remove_collection_item: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_item_id: string
        }
        Returns: Json
      }
      reopen_collection: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_reason: string
          p_request_hash: string
        }
        Returns: Json
      }
      reserve_document_share_email_delivery: {
        Args: {
          p_idempotency_hash: string
          p_lease_seconds?: number
          p_share_id: string
        }
        Returns: Json
      }
      reset_document_rate_limit: {
        Args: {
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: undefined
      }
      retry_document_job: {
        Args: {
          p_collection_id: string
          p_document_id: string
          p_job_type?: string
        }
        Returns: Json
      }
      revise_collection_document: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_reason: string
          p_request_hash: string
          p_revision_type: string
          p_source_document_id: string
          p_typed_document_patch: Json
        }
        Returns: Json
      }
      revoke_document_share: { Args: { p_share_id: string }; Returns: Json }
      save_collection_signature: {
        Args: {
          p_acceptance_text: string
          p_byte_size: number
          p_collection_id: string
          p_expected_version: number
          p_file_sha256: string
          p_signer_name: string
          p_signer_tax_id: string
          p_storage_path: string
        }
        Returns: Json
      }
      save_company_issuer_settings:
        | {
            Args: {
              p_city: string
              p_district: string
              p_legal_name: string
              p_logo_asset_id?: string
              p_phone: string
              p_postal_code: string
              p_receipt_legal_text: string
              p_signer_name: string
              p_signer_title: string
              p_state_code: string
              p_street: string
              p_street_number: string
              p_tax_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_address_complement: string
              p_city: string
              p_district: string
              p_legal_name: string
              p_logo_asset_id: string
              p_logo_path: string
              p_organization_id: number
              p_phone: string
              p_postal_code: string
              p_receipt_legal_text: string
              p_signer_name: string
              p_signer_title: string
              p_state_code: string
              p_street: string
              p_street_number: string
              p_tax_id: string
              p_template_version?: string
            }
            Returns: Json
          }
      update_collection_draft: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_patch: Json
        }
        Returns: Json
      }
      update_collection_item:
        | {
            Args: {
              p_collection_id: string
              p_condition_note?: string
              p_description?: string
              p_expected_version: number
              p_item_id: string
              p_observation?: string
              p_position?: number
              p_quantity?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_collection_id: string
              p_expected_version: number
              p_item_id: string
              p_patch: Json
            }
            Returns: Json
          }
      update_service_progress: {
        Args: {
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_items: Json
          p_request_hash: string
        }
        Returns: Json
      }
      validate_document_issuer_profile: {
        Args: { p_issuer_profile_id: string; p_organization_id: number }
        Returns: Json
      }
      verify_collection_document: {
        Args: { p_verification_token: string }
        Returns: {
          collection_status: string
          document_version: number
          is_authentic: boolean
          issued_at: string
          official_code: string
          organization_name: string
        }[]
      }
      workshop_check_in: {
        Args: {
          p_administrator_name: string
          p_administrator_tax_id: string
          p_collection_id: string
          p_expected_version: number
          p_idempotency_key: string
          p_items: Json
          p_request_hash: string
          p_signature_intent_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
