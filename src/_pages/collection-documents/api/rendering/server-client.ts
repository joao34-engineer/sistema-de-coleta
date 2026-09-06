import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/api/database.types";
import { assertServiceProjectRef, getServiceEnvironment } from "@/shared/config/environment";

type PhaseTwoRow = Readonly<Record<string, unknown>>;
type PhaseTwoTable = { Row: PhaseTwoRow; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
type PhaseTwoDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "document_jobs" | "document_artifacts" | "documents"> & {
      document_jobs: PhaseTwoTable;
      document_artifacts: PhaseTwoTable;
      documents: PhaseTwoTable;
    };
  };
};

export type PhaseTwoSupabaseClient = SupabaseClient<PhaseTwoDatabase>;

export function createPhaseTwoServiceClient(): PhaseTwoSupabaseClient {
  const environment = getServiceEnvironment();
  assertServiceProjectRef(environment);
  return createClient<PhaseTwoDatabase>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function toSupabaseJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toSupabaseJson);
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, toSupabaseJson(item)]));
  }
  throw new TypeError("Valor não serializável para o Supabase.");
}
