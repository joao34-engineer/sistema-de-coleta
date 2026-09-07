"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { DashboardActivityItem } from "../model/contracts";
import { dashboardActivityStatusLabel, latestActivities } from "../model/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { buttonClassName } from "@/shared/ui/button";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Card } from "@/shared/ui/card";
import { operatorGivenName } from "@/shared/auth/operator-display-name";

type Props = Readonly<{
  administrator: AuthenticatedAdministrator;
  activities: ReadonlyArray<DashboardActivityItem>;
  inProgressCount: number;
  readyForDeliveryCount: number;
  loadFailed?: boolean;
  todayLabel: string;
}>;

function readyForDeliveryNote(count: number): string {
  if (count === 0) return "Nenhuma pronta para entrega";
  if (count === 1) return "1 pronta para entrega";
  return `${count} prontas para entrega`;
}

export function DashboardPage({
  administrator,
  activities,
  inProgressCount,
  readyForDeliveryCount,
  loadFailed = false,
  todayLabel,
}: Props) {
  const router = useRouter();
  const firstName = operatorGivenName(administrator.fullName);
  const upcomingActivities = latestActivities(activities, 2);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <MobilePageHeader
        logoSrc="/logo/Logo_-_MJT-removebg-preview.png"
        title={`Olá, ${firstName}`}
        subtitle="Operação de hoje"
      />

      <div className="flex flex-col px-6 pt-4">
        <p className="text-[14px] font-normal leading-5 text-[var(--color-text-muted)]">{todayLabel}</p>

        <h1 className="mt-2.5 text-[28px] font-semibold leading-8 tracking-tight text-[var(--color-text-primary)]">
          Organize a rota{" "}
          <br />
          sem perder o controle.
        </h1>

        {loadFailed ? (
          <div className="mt-6">
            <MobileStatePanel
              type="error"
              title="Não foi possível carregar as coletas"
              subtitle="Ocorreu um erro ao consultar o servidor. Seus dados não foram alterados."
              actionText="Tentar novamente"
              onAction={() => router.refresh()}
            />
          </div>
        ) : (
          <>
            <Card className="mt-6 flex min-h-[120px] flex-col justify-center gap-1 p-5 shadow-[0px_1px_3px_0px_rgba(40,49,43,0.05)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Coletas em andamento
              </span>
              <div className="flex items-end gap-5">
                <span className="text-[36px] font-semibold leading-8 text-[var(--color-primary-strong)]">
                  {String(inProgressCount).padStart(2, "0")}
                </span>
                <span className="pb-1 text-[13px] font-normal leading-5 text-[var(--color-text-muted)]">
                  {readyForDeliveryNote(readyForDeliveryCount)}
                </span>
              </div>
            </Card>

            <PendingNavLink
              href={"/coletas/nova" as Route}
              className={`${buttonClassName({ variant: "primary", size: "md" })} mt-6 justify-start`}
              contentClassName="flex w-full items-center justify-start"
              pendingClassName="opacity-80 ring-2 ring-white/40"
            >
              Nova coleta
            </PendingNavLink>

            <section className="mt-6 flex flex-col gap-[14px]">
              <h2 className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">Próximas atividades</h2>

              {upcomingActivities.length === 0 ? (
                <MobileStatePanel
                  type="empty"
                  title="Nenhuma atividade por aqui"
                  subtitle="Quando houver coletas em andamento, elas aparecerão nesta lista."
                />
              ) : (
                upcomingActivities.map((item) => (
                  <PendingNavLink
                    key={item.id}
                    href={(item.status === "draft" ? `/coletas/${item.id}/itens` : `/coletas/${item.id}`) as Route}
                    className="flex min-h-[96px] flex-col justify-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-4 shadow-[0px_1px_3px_0px_rgba(40,49,43,0.05)]"
                    contentClassName="flex w-full flex-col items-start"
                    pendingClassName="opacity-70 ring-2 ring-[var(--color-primary)]/30"
                  >
                    <span className="inline-flex h-7 items-center rounded-full bg-[var(--color-surface-green)] px-2.5 text-[12px] font-semibold text-[var(--color-primary-strong)]">
                      {dashboardActivityStatusLabel(item.status)}
                    </span>
                    <span className="mt-2 text-[14px] font-semibold leading-5 text-[var(--color-text-primary)]">
                      {item.officialCode ?? dashboardActivityStatusLabel(item.status)}
                    </span>
                    <span className="text-[12px] font-normal leading-4 text-[var(--color-text-muted)]">
                      {item.customerName ?? "Cliente não informado"}
                    </span>
                  </PendingNavLink>
                ))
              )}
            </section>
          </>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}
