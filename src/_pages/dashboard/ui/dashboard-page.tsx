"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import type { DashboardActivityItem, DashboardActivityStatus } from "../model/contracts";
import { countInProgress, countReadyForDelivery, latestActivities } from "../model/contracts";
import { signOutAction, initialSignOutState } from "@/shared/auth/actions";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { Button, buttonClassName } from "@/shared/ui/button";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Card, CardHeader, CardFooter } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

const statusLabels: Readonly<Record<DashboardActivityStatus, string>> = {
  draft: "Rascunho",
  collected: "Coletada",
  canceled: "Cancelada",
  in_workshop: "Em oficina",
  in_budget: "Em orçamento",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  in_service: "Em reparo",
  ready: "Pronta",
  invoiced: "Faturada",
  partial_delivery: "Entrega parcial",
  delivered: "Entregue",
  rejected: "Não aprovada",
  reopened: "Reaberta",
};

type Props = Readonly<{
  administrator: AuthenticatedAdministrator;
  settings: CompanySettingsDTO;
  activities: ReadonlyArray<DashboardActivityItem>;
  loadFailed?: boolean;
  todayLabel: string;
}>;

export function DashboardPage({ administrator, settings, activities, loadFailed = false, todayLabel }: Props) {
  const router = useRouter();
  const [, signOutFormAction] = useActionState(signOutAction, initialSignOutState);
  const firstName = (administrator.fullName || administrator.email).split(" ")[0] ?? administrator.email;
  const isSetupComplete = settings.setupStatus === "complete";

  const inProgressCount = countInProgress(activities);
  const readyCount = countReadyForDelivery(activities);
  const upcomingActivities = latestActivities(activities, 3);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        logoSrc="/logo/Logo_-_MJT-removebg-preview.png"
        title={`Olá, ${firstName}`}
        subtitle="Operação de hoje"
        badge={
          <form action={signOutFormAction}>
            <Button variant="secondary" size="sm" type="submit">
              Sair
            </Button>
          </form>
        }
      />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <p className="text-[12px] font-normal capitalize text-[var(--color-text-muted)]">{todayLabel}</p>

        {/* Headline do Figma Node 13:2 */}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
          Organize a rota,
          <br />
          sem perder o controle.
        </h1>

        {loadFailed ? (
          <MobileStatePanel
            type="error"
            title="Não foi possível carregar as coletas"
            subtitle="Ocorreu um erro ao consultar o servidor. Seus dados não foram alterados."
            actionText="Tentar novamente"
            onAction={() => router.refresh()}
          />
        ) : (
          <>
            {/* Card contador de coletas em andamento */}
            <Card className="flex flex-col gap-1 p-5 bg-[var(--color-card-bg)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Coletas em andamento
              </span>
              <span className="text-[36px] font-semibold leading-tight text-[var(--color-text-primary)]">
                {inProgressCount}
              </span>
              <span className="text-[13px] font-normal text-[var(--color-text-muted)]">
                {readyCount === 0
                  ? "Nenhuma pronta para entrega"
                  : `${readyCount} ${readyCount === 1 ? "pronta" : "prontas"} para entrega`}
              </span>
            </Card>

            {/* Ações principais */}
            <PendingNavLink
              href={"/coletas/nova" as Route}
              className={buttonClassName({ variant: "primary", size: "md" })}
              contentClassName="flex w-full items-center justify-center"
              pendingClassName="opacity-80 ring-2 ring-white/40"
            >
              Nova coleta
            </PendingNavLink>
            <PendingNavLink
              href={"/coletas/rascunhos" as Route}
              className="text-center text-[13px] font-semibold text-[var(--color-primary)]"
              contentClassName="block w-full"
              pendingClassName="opacity-70"
            >
              Ver rascunhos
            </PendingNavLink>

            {/* Próximas atividades */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Próximas atividades</h2>

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
                    className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs transition-all hover:border-[var(--color-primary)] active:scale-[0.99]"
                    contentClassName="flex w-full items-center justify-between"
                    pendingClassName="opacity-70 ring-2 ring-[var(--color-primary)]/30"
                  >
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                        {item.officialCode ?? statusLabels[item.status]}
                      </h3>
                      <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
                        {item.customerName ?? "Cliente não informado"}
                      </p>
                    </div>
                    <Badge status={item.status}>{statusLabels[item.status]}</Badge>
                  </PendingNavLink>
                ))
              )}
            </section>
          </>
        )}

        {/* Status de Configuração Institucional */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">Perfil Emissor MJT</h3>
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
            <PendingNavLink
              href={"/configuracoes/empresa" as Route}
              className={buttonClassName({ variant: "secondary", size: "md", className: "w-full" })}
              contentClassName="flex w-full items-center justify-center"
              pendingClassName="opacity-80 ring-2 ring-[var(--color-primary)]/30"
            >
              Configurações da Empresa
            </PendingNavLink>
          </CardFooter>
        </Card>
      </div>

      <MobileBottomNav />
    </main>
  );
}
