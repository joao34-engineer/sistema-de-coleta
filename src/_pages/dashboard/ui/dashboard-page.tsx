import Link from "next/link";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { signOutAction } from "@/shared/auth/index.server";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardFooter } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

type Props = Readonly<{ administrator: AuthenticatedAdministrator; settings: CompanySettingsDTO }>;

export function DashboardPage({ administrator, settings }: Props) {
  const greeting = administrator.fullName || administrator.email;
  const isSetupComplete = settings.setupStatus === "complete";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      {/* Mobile Page Header do Figma com Botão de Logout */}
      <MobilePageHeader
        title="Início"
        subtitle={`Olá, ${greeting}`}
        badge={
          <form action={signOutAction}>
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              className="min-h-[38px] px-3.5 text-[12px] font-semibold text-[#ba5b52] hover:bg-[#fdf2f1] hover:border-[#fca5a5]"
            >
              Sair 🚪
            </Button>
          </form>
        }
      />

      <div className="flex flex-col gap-4 px-4">
        {/* Card Resumo do Figma (342x120px) */}
        <Card className="flex flex-col gap-2 p-5 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {administrator.organizationName}
            </span>
            <Badge status="collected">Operação Ativa</Badge>
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Sistema de Coleta MJT
          </h2>
          <p className="text-[13px] text-[var(--color-muted)]">
            Gerencie coletas no cliente e acompanhe os reparos da oficina.
          </p>
        </Card>

        {/* Botão de Ação Rápida Nova Coleta */}
        <Link href={"/coletas/nova" as Route}>
          <Button variant="primary" size="md">
            + Nova Coleta
          </Button>
        </Link>

        {/* Status de Configuração Institucional */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Perfil Emissor MJT
              </h3>
              <Badge status={isSetupComplete ? "ready" : "draft"}>
                {isSetupComplete ? "Pronto" : "Pendente"}
              </Badge>
            </div>
            <p className="text-[12px] text-[var(--color-muted)]">
              {isSetupComplete
                ? "Dados jurídicos e logo institucional confirmados."
                : "Complete o endereço e logo para habilitar recibos."}
            </p>
          </CardHeader>
          <CardFooter>
            <Link href={"/configuracoes/empresa" as Route} className="w-full">
              <Button variant="secondary" size="md">
                Configurações da Empresa
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Acessos Rápidos Mobile */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={"/coletas" as Route}>
            <Card className="flex flex-col items-center justify-center py-4 text-center transition-colors hover:border-[var(--color-primary)]">
              <span className="text-2xl">📋</span>
              <span className="mt-1 text-[12px] font-semibold text-[var(--color-text)]">
                Lista de Coletas
              </span>
            </Card>
          </Link>
          <Link href={"/coletas" as Route}>
            <Card className="flex flex-col items-center justify-center py-4 text-center transition-colors hover:border-[var(--color-primary)]">
              <span className="text-2xl">⏳</span>
              <span className="mt-1 text-[12px] font-semibold text-[var(--color-text)]">
                Rascunhos Em Aberto
              </span>
            </Card>
          </Link>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}

export function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Acesso não autorizado</h1>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Esta conta não possui um vínculo administrativo ativo com a MJT.
        </p>
      </Card>
    </main>
  );
}
