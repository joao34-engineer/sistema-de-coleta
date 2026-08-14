import { redirect } from "next/navigation";
import { hasPublicEnvironment } from "@/shared/config/environment";
import { routes } from "@/shared/config/routes";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";

export default async function HomePage() {
  if (!hasPublicEnvironment()) return <main className="flex min-h-screen items-center justify-center px-4"><p className="max-w-md text-center text-sm text-muted">Ambiente ainda não configurado. Defina as variáveis públicas do Supabase para habilitar a aplicação.</p></main>;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? routes.dashboard : routes.login);
}
