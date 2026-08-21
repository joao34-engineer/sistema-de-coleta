"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export interface BillingReferenceProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  existingReference?: {
    number: string;
    series: string;
    issuedAt: string;
    totalBrl: number;
    notes?: string | null;
  } | null;
}

export function BillingReferencePage({
  collectionId,
  officialCode,
  expectedVersion,
  existingReference,
}: BillingReferenceProps) {
  const [number, setNumber] = useState(existingReference?.number ?? "");
  const [series, setSeries] = useState(existingReference?.series ?? "1");
  const [issuedAt, setIssuedAt] = useState(
    existingReference?.issuedAt ?? new Date().toISOString().slice(0, 10)
  );
  const [totalBrl, setTotalBrl] = useState<number>(existingReference?.totalBrl ?? 0);
  const [notes, setNotes] = useState(existingReference?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!number.trim()) {
      setErrorMsg("Informe o número da NF-e.");
      return;
    }
    if (!series.trim()) {
      setErrorMsg("Informe a série da NF-e.");
      return;
    }
    if (totalBrl <= 0) {
      setErrorMsg("O valor total da nota fiscal deve ser maior que zero.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
    }, 600);
  };

  if (success) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center flex flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef8f2] text-[#31674c] text-2xl font-bold border border-[#4c916f]">
          🧾
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          Referência Fiscal Registrada!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          NF-e nº {number} Série {series} vinculada à coleta {officialCode ?? collectionId}.
        </p>
        <div className="mt-6 w-full">
          <Link href={`/coletas/${collectionId}/operacao` as Route}>
            <Button variant="primary" size="md">
              Voltar ao Painel Operacional
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Faturamento"
        subtitle="Referência fiscal"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            Emitir NF-e ou vincular.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId}
          </p>
        </div>

        {/* Card de Faturamento do Figma M15 */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Dados da Nota Fiscal (NF-e)
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Número da NF-e *"
                placeholder="Ex: 0001049"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
              />
              <Input
                label="Série *"
                placeholder="1"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Data de Emissão *"
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
              <Input
                label="Valor Total (R$) *"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={totalBrl || ""}
                onChange={(e) => setTotalBrl(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-muted)]">
                Observações Fiscais
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações de retenção..."
                className="w-full rounded-[12px] border border-[var(--color-border)] p-3 text-[14px] text-[var(--color-text)] placeholder-[var(--color-border-subdued)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </CardContent>
        </Card>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          size="md"
        >
          Salvar referência fiscal
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
