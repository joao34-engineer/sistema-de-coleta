"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { approveBudgetAction } from "../api/actions";

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  budgetTotal: number;
  rowVersion: number;
}>;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function BudgetApprovalPage({ collectionId, officialCode, budgetTotal, rowVersion }: Props) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerTaxId, setSignerTaxId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(approved: boolean) {
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!approved && rejectionReason.trim().length < 5) {
      setErrorMsg("Informe o motivo da rejeição (mínimo 5 caracteres).");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await approveBudgetAction(
        collectionId,
        {
          collectionId,
          expectedVersion: rowVersion,
          approved,
          rejectionReason: approved ? undefined : rejectionReason.trim(),
          signerName: signerName.trim(),
          signerTaxId: signerTaxId.trim(),
        },
        crypto.randomUUID(),
      );

      if (!result.ok) {
        setErrorMsg(result.error);
        setIsSubmitting(false);
        return;
      }

      startTransition(() => {
        router.push(`/coletas/${collectionId}` as Route);
      });
    } catch {
      setErrorMsg("Não foi possível registrar a decisão. Verifique a conexão e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Aprovação do orçamento"
        subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        <Card className="flex flex-col gap-1 bg-[var(--color-card-bg)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total do orçamento</span>
          <span className="text-[28px] font-semibold leading-tight text-[var(--color-text-primary)]">{formatBrl(budgetTotal)}</span>
        </Card>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        <Input
          label="Nome do responsável *"
          placeholder="Nome completo de quem decide"
          value={signerName}
          maxLength={160}
          onChange={(event) => setSignerName(event.target.value)}
          disabled={isSubmitting}
          required
        />

        <Input
          label="CPF/CNPJ do responsável *"
          placeholder="000.000.000-00"
          inputMode="numeric"
          value={signerTaxId}
          onChange={(event) => setSignerTaxId(event.target.value)}
          disabled={isSubmitting}
          required
        />

        <Input
          label="Motivo da rejeição *"
          helperText="(obrigatório ao rejeitar)"
          placeholder="Ex.: valor acima do orçado para o reparo"
          value={rejectionReason}
          maxLength={1000}
          onChange={(event) => setRejectionReason(event.target.value)}
          disabled={isSubmitting}
        />

        <div className="mt-2 grid grid-cols-2 gap-3">
          <Button
            variant="primary"
            size="md"
            isLoading={isSubmitting || isPending}
            onClick={() => void handleSubmit(true)}
            className="h-[52px]"
          >
            Aprovar
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isSubmitting || isPending}
            onClick={() => void handleSubmit(false)}
            className="h-[52px]"
          >
            Rejeitar
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
