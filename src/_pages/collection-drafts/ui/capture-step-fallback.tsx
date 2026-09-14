"use client";

import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";

export function CaptureStepFallback() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Coleta" subtitle="Carregando" backHref={"/coletas" as Route} />
      <MobileStatePanel type="loading" title="Carregando coleta" subtitle="Buscando os dados do cliente." />
      <MobileBottomNav />
    </main>
  );
}
