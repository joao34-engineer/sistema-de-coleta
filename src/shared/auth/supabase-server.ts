import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/shared/api/database.types";
import { getPublicEnvironment } from "@/shared/config/environment";

export type CookieMutation = "best-effort" | "required";

export async function createServerSupabaseClient(
  options: Readonly<{ cookieMutation?: CookieMutation }> = {},
) {
  const environment = getPublicEnvironment();
  const cookieMutation = options.cookieMutation ?? "best-effort";
  const cookieStore = await cookies();

  return createServerClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (error) {
          if (cookieMutation === "required") throw error;
        }
      },
    },
  });
}
