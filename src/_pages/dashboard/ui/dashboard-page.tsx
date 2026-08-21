import Link from "next/link";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { signOutAction } from "@/shared/auth/index.server";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardFooter } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

type Props = Readonly<{ administrator: AuthenticatedAdministrator; settings: CompanySettingsDTO }>;

export function DashboardPage({ administrator, settings }: Props) {
  const greeting = administrator.fullName || administrator.email;
  const isSetupComplete = settings.setupStatus === "complete";

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
      {/* Mobile Top Header (MJT Header) */}
      <header className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            {administrator.organizationName}
          </span>
          <h1 className="mt-0.5 text-2xl font-bold text-[var(--color-text)]">
            Olá, {greeting}
          </h1>
        </div>
        <form action={signOutAction}>
          <Button variant="secondary" size="sm" type="submit">
            Sair
          </Button>
        </form>
      </header>

      <div className="flex flex-col gap-5">
        {/* Ação Principal Mobile: Nova Coleta */}
        <Card className="bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-green)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge status="collected">Sistema Ativo</Badge>
              <span className="text-xs text-[var(--color-muted)]">Coletor Mobile</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">
              Iniciar Nova Coleta
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Registre a retirada de equipamentos com autosave e assinatura na tela.
            </p>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link href={"/coletas/nova" as Route} className="w-full">
              <Button variant="primary" className="w-full text-sm">
                + Nova Coleta
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Status de Configuração Institucional */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Perfil Emissor MJT
              </h3>
              <Badge status={isSetupComplete ? "ready" : "draft"}>
                {isSetupComplete ? "Pronto para emissão" : "Configuração pendente"}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              {isSetupComplete
                ? "Dados jurídicos e logo institucional confirmados para guias."
                : "Complete o endereço e logo para habilitar a emissão de recibos."}
            </p>
          </CardHeader>
          <CardFooter>
            <Link href="/configuracoes/empresa" className="w-full">
              <Button variant="secondary" size="sm" className="w-full">
                Configurações da Empresa
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Acessos Rápidos Mobile */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={"/coletas" as Route}>
            <Card className="flex flex-col items-center justify-center py-5 text-center transition-colors hover:border-[var(--color-primary)]">
              <span className="text-2xl">📋</span>
              <span className="mt-2 text-xs font-semibold text-[var(--color-text)]">
                Lista de Coletas
              </span>
            </Card>
          </Link>
          <Link href={"/coletas/rascunhos" as Route}>
            <Card className="flex flex-col items-center justify-center py-5 text-center transition-colors hover:border-[var(--color-primary)]">
              <span className="text-2xl">⏳</span>
              <span className="mt-2 text-xs font-semibold text-[var(--color-text)]">
                Rascunhos Em Aberto
              </span>
            </Card>
          </Link>
        </div>
      </div>
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
