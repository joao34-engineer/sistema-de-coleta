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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Início"
        subtitle="Visão geral da operação"
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
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Operação diária
          </span>
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

        {/* Seção Coletas Recentes */}
        <div className="mt-2 flex flex-col gap-3">
          <h3 className="text-[16px] font-semibold text-[var(--color-text)]">
            Coletas recentes
          </h3>

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                MJT-2026-000021
              </span>
              <Badge status="collected">Coletada</Badge>
            </div>
            <p className="text-[13px] text-[var(--color-muted)]">
              Clínica Horizonte · 4 itens registrados
            </p>
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--color-text)]">
                MJT-2026-000020
              </span>
              <Badge status="ready">Pronto</Badge>
            </div>
            <p className="text-[13px] text-[var(--color-muted)]">
              Confecções Vale · 2 itens finalizados
            </p>
          </Card>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
