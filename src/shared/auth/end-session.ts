import "server-only";

import { createServerSupabaseClient } from "./supabase-server";

export async function endSession(): Promise<void> {
  const supabase = await createServerSupabaseClient({ cookieMutation: "required" });
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("sign_out_failed");
}
