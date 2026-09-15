"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
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
    subtitle: "Histórico preservado",
    introTitle: "Esta guia continuará existindo.",
    introBody: "O número oficial não é reutilizado. O histórico e o motivo ficam registrados.",
    buttonLabel: "Confirmar cancelamento",
    buttonVariant: "danger" as const,
    reasonLabel: "Motivo do cancelamento *",
    placeholder: "Ex.: cliente desistiu do serviço",
  },
  reopen: {
    title: "Reabrir coleta",
    subtitle: "Mesmo número oficial",
    introTitle: "O mesmo número oficial é preservado.",
    introBody: "A reabertura reativa o mesmo registro e gera nova versão documental se a guia já existia.",
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
        subtitle={copy.subtitle}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg && (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,white)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">
            {errorMsg}
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-[24px] font-semibold leading-8 text-[var(--color-text-primary)]">{copy.introTitle}</h2>
          <p className="text-[14px] leading-5 text-[var(--color-text-muted)]">{copy.introBody}</p>
          {officialCode ? (
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Guia {officialCode}</p>
          ) : null}
        </section>

        <Card className="flex w-full max-w-[342px] flex-col gap-3 bg-[var(--color-card-bg)]">
          <Input
            label={copy.reasonLabel}
            placeholder={copy.placeholder}
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            required
          />
          <p className="text-[12px] font-normal text-[var(--color-text-muted)]">Ação auditada pela administradora</p>
        </Card>

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

    </main>
  );
}
