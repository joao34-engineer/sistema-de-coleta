"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { cancelOrReopenCollectionAction } from "../api/actions";
import { useWorkshopHubSubmit } from "../model/use-workshop-hub-submit";

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  allowedAction: "cancel" | "reopen";
  rowVersion: number;
}>;

const actionCopy = {
  cancel: {
    title: "Cancelar coleta",
    buttonLabel: "Confirmar cancelamento",
    buttonVariant: "danger" as const,
    reasonLabel: "Motivo do cancelamento *",
    placeholder: "Ex.: cliente desistiu do serviço",
  },
  reopen: {
    title: "Reabrir coleta",
    buttonLabel: "Confirmar reabertura",
    buttonVariant: "primary" as const,
    reasonLabel: "Motivo da reabertura *",
    placeholder: "Ex.: cliente retornou com o equipamento",
  },
} as const;

export function CancelReopenPage({ collectionId, officialCode, allowedAction, rowVersion }: Props) {
  const [reason, setReason] = useState("");
  const { error: errorMsg, isPending, setError, submit } = useWorkshopHubSubmit(collectionId);
  const copy = actionCopy[allowedAction];

  function handleSubmit() {
    if (reason.trim().length < 5) {
      setError("Informe uma justificativa de no mínimo 5 caracteres.");
      return;
    }

    submit(async () =>
      cancelOrReopenCollectionAction(
        collectionId,
        {
          collectionId,
          expectedVersion: rowVersion,
          action: allowedAction,
          reason: reason.trim(),
        },
        crypto.randomUUID(),
      ),
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title={copy.title}
        subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        <Card className="flex flex-col gap-2 bg-[var(--color-card-bg)]">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Justificativa obrigatória</span>
          <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
            Esta operação fica registrada no histórico da coleta com sua justificativa.
          </p>
        </Card>

        <Input
          label={copy.reasonLabel}
          placeholder={copy.placeholder}
          value={reason}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          required
        />

        <Button
          variant={copy.buttonVariant}
          size="md"
          isLoading={isPending}
          onClick={() => void handleSubmit()}
          className="mt-2 h-[52px]"
        >
          {copy.buttonLabel}
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
