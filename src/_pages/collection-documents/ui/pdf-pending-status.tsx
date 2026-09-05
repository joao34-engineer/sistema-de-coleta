"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 3000;
const MAX_REFRESHES = 20;

type Props = Readonly<{
  pending: boolean;
  refreshMs?: number;
  maxRefreshes?: number;
}>;

/** Reloads Documentos while the PDF artifact is still missing after finalize. */
export function PdfPendingStatus({ pending, refreshMs = REFRESH_MS, maxRefreshes = MAX_REFRESHES }: Props) {
  const router = useRouter();
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    if (!pending) {
      setExhausted(false);
      return;
    }
    let ticks = 0;
    setExhausted(false);
    const timer = window.setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= maxRefreshes) {
        window.clearInterval(timer);
        setExhausted(true);
      }
    }, refreshMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [pending, router, refreshMs, maxRefreshes]);

  if (!pending) {
    return null;
  }

  return (
    <p
      role="status"
      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-medium text-[var(--color-text-primary)]"
    >
      {exhausted
        ? "O PDF ainda está sendo processado. Atualize a página em instantes."
        : "Gerando o PDF da guia. Isso leva alguns segundos. Depois você pode baixar ou compartilhar no WhatsApp."}
    </p>
  );
}
