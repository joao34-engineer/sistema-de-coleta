"use client";

import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";

export type RouteErrorFallbackProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
  const digest = typeof error.digest === "string" && error.digest.length > 0 ? error.digest : null;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center bg-[var(--color-surface-bg)] px-4">
      <MobileStatePanel
        type="error"
        title="Algo deu errado"
        subtitle="Não foi possível carregar esta tela."
        actionText="Tentar novamente"
        onAction={reset}
        footer={
          digest ? (
            <p className="mt-3 rounded-[8px] bg-[var(--color-surface-neutral)] px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)]">
              Ref: {digest}
            </p>
          ) : null
        }
      />
    </main>
  );
}
