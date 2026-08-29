"use client";

import { Button } from "@/shared/ui/button";

export type RouteErrorFallbackProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
  const digest = typeof error.digest === "string" && error.digest.length > 0 ? error.digest : null;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-[20px] font-semibold text-[var(--color-text-primary)]">Algo deu errado</h1>
      <p className="text-[14px] text-[var(--color-text-muted)]">Não foi possível carregar esta tela.</p>
      {digest ? (
        <p className="rounded-[8px] bg-[var(--color-surface-neutral)] px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)]">
          Ref: {digest}
        </p>
      ) : null}
      <Button type="button" onClick={reset} className="max-w-xs">
        Tentar novamente
      </Button>
    </main>
  );
}
