import "server-only";

import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";

export async function getCollectionOfficialCode(collectionId: string): Promise<string | null> {
  await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("collections").select("official_code").eq("id", collectionId).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const value = data.official_code;
  return typeof value === "string" && value.length > 0 ? value : null;
}
