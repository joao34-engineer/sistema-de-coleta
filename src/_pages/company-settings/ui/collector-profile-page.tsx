import Link from "next/link";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { PwaStatusCard } from "./pwa-status-card";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  administrator: AuthenticatedAdministrator;
}>;

export function CollectorProfilePage({ administrator }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
      {/* Top Header Mobile */}
      <header className="mb-6">
        <Link
          href={"/dashboard" as Route}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          ← Voltar ao Dashboard
        </Link>
        <div className="mt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            MJT · Perfil & Preferências
          </span>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            Configurações
          </h1>
        </div>
      </header>

      <div className="flex flex-col gap-5">
        {/* Card do Perfil do Operador */}
        <Card className="flex flex-col gap-3">
          <CardHeader>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Operador Autenticado
            </span>
            <h2 className="text-lg font-bold text-[var(--color-text)]">
              {administrator.fullName || "Coletor MJT"}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {administrator.email}
            </p>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 text-xs border-t border-[var(--color-border)] pt-3">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Empresa / Organização:</span>
              <span className="font-semibold">{administrator.organizationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Perfil Operacional:</span>
              <span className="font-semibold uppercase">{administrator.role}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card da PWA */}
        <PwaStatusCard />

        {/* Link para Configurações da Empresa */}
        <Card className="flex flex-col gap-3">
          <CardHeader>
            <h3 className="text-base font-bold text-[var(--color-text)]">
              Dados Jurídicos da Empresa
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Gerencie a razão social, CNPJ, logotipo e endereço para emissão dos recibos.
            </p>
          </CardHeader>
          <CardFooter>
            <Link href={"/configuracoes/empresa" as Route} className="w-full">
              <Button variant="secondary" size="sm" className="w-full">
                Configurar Perfil Institucional
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
