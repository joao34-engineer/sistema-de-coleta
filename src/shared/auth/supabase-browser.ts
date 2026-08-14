"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnvironment } from "@/shared/config/environment";
import type { Database } from "@/shared/api/database.types";

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const environment = getPublicEnvironment();
  return createBrowserClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey);
}
