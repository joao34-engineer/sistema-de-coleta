"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { registerInvoiceReferenceAction } from "@/_app/actions/phase3-flow.actions";

type ExistingInvoice = Readonly<{
  number: string;
  series: string;
  issuedAt: string;
  totalBrl: number;
  notes: string | null;
}>;

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  existingInvoice: ExistingInvoice | null;
  rowVersion: number;
}>;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function toIsoLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function InvoiceReferencePage({ collectionId, officialCode, existingInvoice, rowVersion }: Props) {
  const router = useRouter();
  const [number, setNumber] = useState(existingInvoice?.number ?? "");
  const [series, setSeries] = useState(existingInvoice?.series ?? "");
  const [issuedAt, setIssuedAt] = useState(() => {
    if (!existingInvoice) return "";
    const date = new Date(existingInvoice.issuedAt);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  const [totalBrl, setTotalBrl] = useState(existingInvoice ? String(existingInvoice.totalBrl).replace(".", ",") : "");
  const [notes, setNotes] = useState(existingInvoice?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit() {
    const parsedTotal = Number(totalBrl.replace(/\./g, "").replace(",", "."));
    const issues: string[] = [];
    if (!number.trim()) issues.push("Informe o número da NF-e.");
    if (!series.trim()) issues.push("Informe a série da NF-e.");
    if (!issuedAt) issues.push("Informe a data de emissão.");
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) issues.push("Informe um valor total maior que zero.");
    if (notes.length > 1000) issues.push("As observações devem ter no máximo 1000 caracteres.");
    if (issues.length > 0) {
      setErrorMsg(issues.join(" "));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await registerInvoiceReferenceAction(
        collectionId,
        {
          collectionId,
          expectedVersion: rowVersion,
          number: number.trim(),
          series: series.trim(),
          issuedAt: toIsoLocal(issuedAt),
          totalBrl: Number(parsedTotal.toFixed(2)),
          notes: notes.trim() === "" ? undefined : notes.trim(),
        },
        crypto.randomUUID(),
      );

      if (!result.ok) {
        setErrorMsg(result.error);
        setIsSubmitting(false);
        return;
      }

      router.push(`/coletas/${collectionId}` as Route);
    } catch {
      setErrorMsg("Não foi possível registrar a NF-e. Verifique a conexão e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Registro de NF-e"
        subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {existingInvoice ? (
          <Card className="flex flex-col gap-1 bg-[var(--color-card-bg)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Último registro
            </span>
            <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              NF-e {existingInvoice.number} · série {existingInvoice.series}
            </span>
            <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
              {formatBrl(existingInvoice.totalBrl)}
            </span>
          </Card>
        ) : null}

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        <Input
          label="Número da NF-e *"
          placeholder="000000000"
          value={number}
          maxLength={32}
          onChange={(event) => setNumber(event.target.value)}
          required
        />

        <Input
          label="Série *"
          placeholder="1"
          value={series}
          maxLength={10}
          onChange={(event) => setSeries(event.target.value)}
          required
        />

        <Input
          label="Data de emissão *"
          type="datetime-local"
          value={issuedAt}
          onChange={(event) => setIssuedAt(event.target.value)}
          required
        />

        <Input
          label="Valor total (R$) *"
          placeholder="0,00"
          inputMode="decimal"
          value={totalBrl}
          onChange={(event) => setTotalBrl(event.target.value)}
          required
        />

        <Input
          label="Observações (opcional)"
          placeholder="Ex.: nota referente ao serviço completo"
          value={notes}
          maxLength={1000}
          onChange={(event) => setNotes(event.target.value)}
        />

        <Button
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          onClick={() => void handleSubmit()}
          className="mt-2 h-[52px]"
        >
          Registrar NF-e
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
