"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

export type WorkshopMutationResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: string }>;

const NETWORK_FALLBACK = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

export function useWorkshopHubSubmit(collectionId: string): {
  error: string | null;
  isPending: boolean;
  setError: (message: string | null) => void;
  submit: (mutate: () => Promise<WorkshopMutationResult>) => void;
} {
  const router = useRouter();
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(mutate: () => Promise<WorkshopMutationResult>): void {
    if (inFlight.current || isPending) {
      return;
    }
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await mutate();
        if (!result.ok) {
          setError(result.error);
          inFlight.current = false;
          return;
        }
        router.push(`/coletas/${collectionId}` as Route);
      } catch {
        setError(NETWORK_FALLBACK);
        inFlight.current = false;
      }
    });
  }

  return { error, isPending, setError, submit };
}
