"use client";

import { MobileStatePanel } from "./mobile-state-panel";

export function EnvMisconfiguredPanel() {
  return (
    <MobileStatePanel
      type="error"
      title="Ambiente não configurado"
      subtitle="Defina as variáveis públicas do Supabase para habilitar a aplicação."
      actionText="Entendi"
      onAction={() => {
        window.location.reload();
      }}
    />
  );
}
