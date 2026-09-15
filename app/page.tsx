import { redirect } from "next/navigation";
import { hasPublicEnvironment } from "@/shared/config/environment";
import { routes } from "@/shared/config/routes";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { EnvMisconfiguredPanel } from "@/shared/ui/env-misconfigured-panel";

export default async function HomePage() {
  if (!hasPublicEnvironment()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[var(--color-surface-bg)] px-4">
        <EnvMisconfiguredPanel />
      </main>
    );
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? routes.dashboard : routes.login);
}
