import { redirect } from "next/navigation";
import { hasPublicEnvironment } from "@/shared/config/environment";
import { routes } from "@/shared/config/routes";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";

export default async function HomePage() {
  if (!hasPublicEnvironment()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[var(--color-surface-bg)] px-4">
        <MobileStatePanel
          type="error"
          title="Ambiente não configurado"
          subtitle="Defina as variáveis públicas do Supabase para habilitar a aplicação."
        />
      </main>
    );
  }
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? routes.dashboard : routes.login);
}
