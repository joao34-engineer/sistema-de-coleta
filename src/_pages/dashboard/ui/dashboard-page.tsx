import Link from "next/link";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { signOutAction } from "@/shared/auth/index.server";

type Props = Readonly<{ administrator: AuthenticatedAdministrator; settings: CompanySettingsDTO }>;

export function DashboardPage({ administrator, settings }: Props) {
  const greeting = administrator.fullName || administrator.email;
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8"><header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{administrator.organizationName}</p><h1 className="mt-1 text-3xl font-semibold">Olá, {greeting}</h1><p className="mt-2 text-sm text-muted">Fundação do Sistema de Coleta MJT</p></div><form action={signOutAction}><button type="submit" className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold">Sair</button></form></header><div className="grid gap-5 md:grid-cols-2"><section className="rounded-medium border border-border bg-surface p-6 shadow-surface"><h2 className="text-lg font-semibold">Configuração institucional</h2><p className="mt-2 text-sm text-muted">{settings.setupStatus === "complete" ? "Os dados essenciais estão completos." : "Configuração institucional pendente."}</p><Link href="/configuracoes/empresa" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Abrir configurações</Link></section><section className="rounded-medium border border-border bg-surface p-6 shadow-surface"><h2 className="text-lg font-semibold">Coletas</h2><p className="mt-2 text-sm text-muted">A coleta ainda não está disponível na Fase 0. Clientes, itens, fotos e recibos serão habilitados nas próximas fases.</p></section></div></main>;
}

export function AccessDeniedPage() {
  return <main className="flex min-h-screen items-center justify-center px-4"><section className="max-w-md rounded-medium border border-border bg-surface p-7 text-center shadow-surface"><h1 className="text-2xl font-semibold">Acesso não autorizado</h1><p className="mt-3 text-sm text-muted">Esta conta não possui um vínculo administrativo ativo com a MJT.</p></section></main>;
}
