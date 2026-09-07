import Link from "next/link";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { SignOutForm } from "@/shared/ui/sign-out-form";
import { operatorDisplayName } from "@/shared/auth/operator-display-name";

type Props = Readonly<{
  administrator: AuthenticatedAdministrator;
}>;

export function CollectorProfilePage({ administrator }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Empresa"
        subtitle="Dados institucionais"
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Configurações da conta
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            {administrator.email}
          </p>
        </div>

        {/* Card do Perfil do Operador */}
        <Card>
          <CardHeader>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary-strong)]">
              Operador Autenticado
            </span>
            <h3 className="text-[16px] font-semibold text-[var(--color-text)]">
              {operatorDisplayName(administrator.fullName)}
            </h3>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Organização:</span>
              <span className="font-semibold text-[var(--color-text)]">{administrator.organizationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Função:</span>
              <span className="font-semibold uppercase text-[var(--color-text)]">{administrator.role}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card da Empresa do Figma */}
        <Card>
          <CardHeader>
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Dados Jurídicos & Impressão
            </h3>
            <p className="text-[12px] text-[var(--color-muted)]">
              Razão social, CNPJ, telefone e rodapé dos recibos.
            </p>
          </CardHeader>
          <CardFooter>
            <Link href={"/configuracoes/empresa?from=/configuracoes" as Route} className="w-full">
              <Button variant="secondary" size="md">
                Editar Perfil Institucional
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <SignOutForm size="md" />
      </div>

      <MobileBottomNav />
    </main>
  );
}
