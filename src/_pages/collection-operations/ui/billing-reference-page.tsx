"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";

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
      <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-700 text-2xl font-bold border border-sky-200">
          🧾
        </div>
        <h1 className="text-xl font-bold text-gray-900">Referência Fiscal Registrada!</h1>
        <p className="text-xs text-[var(--color-muted)]">
          NF-e nº {number} Série {series} vinculada à coleta {officialCode ?? collectionId}.
        </p>
        <Link href={`/coletas/${collectionId}/operacao`}>
          <Button variant="primary" className="w-full text-xs h-11">
            Voltar para Painel Operacional
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-24">
      <div>
        <Link href={`/coletas/${collectionId}/operacao`} className="text-xs text-[var(--color-primary)] font-medium hover:underline">
          ← Voltar para Painel Operacional
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Faturamento & Referência NF-e</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Registro da Nota Fiscal emitida para a coleta {officialCode ?? collectionId}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Dados da Nota Fiscal (NF-e)</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="nfeNumber" className="mb-1 block text-xs font-medium text-gray-700">
                  Número da NF-e
                </label>
                <input
                  id="nfeNumber"
                  type="text"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ex: 0001049"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
                />
              </div>
              <div>
                <label htmlFor="nfeSeries" className="mb-1 block text-xs font-medium text-gray-700">
                  Série
                </label>
                <input
                  id="nfeSeries"
                  type="text"
                  required
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="1"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="issuedAt" className="mb-1 block text-xs font-medium text-gray-700">
                  Data de Emissão
                </label>
                <input
                  id="issuedAt"
                  type="date"
                  required
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
                />
              </div>
              <div>
                <label htmlFor="totalBrl" className="mb-1 block text-xs font-medium text-gray-700">
                  Valor Total NF-e (R$)
                </label>
                <input
                  id="totalBrl"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={totalBrl || ""}
                  onChange={(e) => setTotalBrl(Number(e.target.value))}
                  placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs font-bold text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-gray-700">
                Observações Fiscais / Retenções (Opcional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais para auditoria financeira..."
                className="w-full rounded-xl border border-[var(--color-border)] p-2.5 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full text-xs h-11 rounded-xl font-semibold"
        >
          Salvar Referência Faturamento NF-e
        </Button>
      </form>
    </div>
  );
}
