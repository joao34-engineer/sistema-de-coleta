import Link from "next/link";
import type { Route } from "next";
import { signOutAction } from "@/shared/auth/index.server";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Olá, Marcelo"
        subtitle="quinta-feira, 14 de agosto"
        badge={
          <form action={signOutAction}>
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              className="min-h-[34px] px-3 text-[11px] font-semibold text-[#ba5b52] hover:bg-[#fdf2f1] hover:border-[#fca5a5]"
            >
              Sair
            </Button>
          </form>
        }
      />

      <div className="flex flex-col gap-5 px-4 pt-3">
        {/* Hero Card do Figma (M01 - Node 13:2) */}
        <Card className="flex flex-col gap-3 p-5 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-[16px]">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
              Organize a rota
            </h2>
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
              sem perder o controle.
            </h2>
          </div>

          <div className="mt-1 flex items-baseline justify-between border-t border-[var(--color-border)] pt-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block">
                COLETAS EM ANDAMENTO
              </span>
              <span className="mt-1 text-[13px] font-normal text-[var(--color-text-muted)] block">
                1 pronta para entrega
              </span>
            </div>
            <span className="text-[36px] font-semibold text-[var(--color-text-primary)] leading-none">
              03
            </span>
          </div>
        </Card>

        {/* Botão de Ação Rápida Nova Coleta */}
        <Link href={"/coletas/nova" as Route} className="w-full">
          <Button variant="primary" size="md" className="h-[52px] rounded-[12px] text-[14px] font-semibold">
            Nova coleta
          </Button>
        </Link>

        {/* Seção Próximas Atividades */}
        <div className="mt-1 flex flex-col gap-3">
          <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Próximas atividades
          </h3>

          <Card className="flex flex-col gap-1.5 p-4 rounded-[14px]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                MJT-2026-000021
              </span>
              <Badge status="collected">Coletada</Badge>
            </div>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Clínica Horizonte · 4 itens
            </p>
          </Card>

          <Card className="flex flex-col gap-1.5 p-4 rounded-[14px]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                MJT-2026-000017
              </span>
              <Badge status="ready">Pronto</Badge>
            </div>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Casa Amaral · 2 itens
            </p>
          </Card>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}

