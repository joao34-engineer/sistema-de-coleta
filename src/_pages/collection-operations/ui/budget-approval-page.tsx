"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { SignaturePad } from "@/shared/ui/signature-pad";

export interface BudgetApprovalProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  customerName: string | null;
  totalBudgetBrl: number;
  items: Array<{
    id: string;
    description: string;
    laborCostBrl: number;
    partsCostBrl: number;
    estimatedDays: number;
  }>;
}

export function BudgetApprovalPage({
  collectionId,
  officialCode,
  expectedVersion,
  customerName,
  totalBudgetBrl,
  items,
}: BudgetApprovalProps) {
  const [signerName, setSignerName] = useState(customerName ?? "");
  const [signerTaxId, setSignerTaxId] = useState("");
  const [approved, setApproved] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decisionOutcome, setDecisionOutcome] = useState<"approved" | "rejected" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!signerName.trim()) {
      setErrorMsg("Informe o nome do responsável pelo aceite/rejeição.");
      return;
    }
    if (!signerTaxId.trim()) {
      setErrorMsg("Informe o CPF ou CNPJ do responsável.");
      return;
    }
    if (!signatureData) {
      setErrorMsg("A assinatura digital do responsável é obrigatória.");
      return;
    }
    if (!approved && rejectionReason.trim().length < 5) {
      setErrorMsg("Informe uma justificativa de no mínimo 5 caracteres para a não aprovação.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setDecisionOutcome(approved ? "approved" : "rejected");
    }, 600);
  };

  if (decisionOutcome) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center flex flex-col items-center justify-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold border ${
            decisionOutcome === "approved"
              ? "bg-[#eef8f2] text-[#31674c] border-[#4c916f]"
              : "bg-[#fdf2f1] text-[#ba5b52] border-[#fca5a5]"
          }`}
        >
          {decisionOutcome === "approved" ? "✓" : "✕"}
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          {decisionOutcome === "approved" ? "Orçamento Aprovado!" : "Orçamento Não Aprovado"}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Decisão registrada para a coleta {officialCode ?? collectionId} por {signerName}.
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
        title="Aprovação do orçamento"
        subtitle="Uso interno"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <span className="text-[13px] font-semibold text-[var(--color-primary-strong)]">
            {officialCode ?? collectionId}
          </span>
          <p className="text-[12px] text-[var(--color-muted)]">
            Cliente: {customerName ?? "Não informado"}
          </p>
        </div>

        {/* Card de Diagnóstico e Custos do Figma M13 */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[12px] font-semibold text-[var(--color-muted)]">
              Diagnóstico ({items.length} {items.length === 1 ? "equipamento" : "equipamentos"})
            </h3>
            <p className="text-[14px] font-semibold text-[var(--color-text)]">
              Correia rompida e revisão necessária
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-2 border-t border-[var(--color-border)]">
            <div>
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Serviços + peças + mão de obra
              </span>
              <p className="text-[14px] text-[var(--color-text)]">
                R$ 120,00 + R$ 40,00 + R$ 60,00
              </p>
            </div>

            <div>
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Desconto
              </span>
              <p className="text-[14px] text-[var(--color-text)]">
                R$ 0,00
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Total · válido até 21 ago
              </span>
              <p className="text-[24px] font-bold text-[var(--color-text)]">
                {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Decision Toggle */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Decisão de Aceite
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setApproved(true)}
                className={`min-h-[48px] rounded-[12px] font-semibold text-[12px] border transition-all ${
                  approved
                    ? "bg-[#eef8f2] text-[#31674c] border-[#4c916f]"
                    : "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]"
                }`}
              >
                ✓ Aprovar
              </button>
              <button
                type="button"
                onClick={() => setApproved(false)}
                className={`min-h-[48px] rounded-[12px] font-semibold text-[12px] border transition-all ${
                  !approved
                    ? "bg-[#fdf2f1] text-[#ba5b52] border-[#fca5a5]"
                    : "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]"
                }`}
              >
                ✕ Rejeitar
              </button>
            </div>

            {!approved && (
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#ba5b52]">
                  Motivo da Rejeição (Obrigatório)
                </label>
                <textarea
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Justificativa para a não aprovação..."
                  className="w-full rounded-[12px] border border-[#fca5a5] p-3 text-[14px] text-[var(--color-text)] focus:outline-none"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signer Credentials & Signature */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Identificação do Signatário
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="Nome do Responsável *"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
            />
            <Input
              label="CPF ou CNPJ do Responsável *"
              placeholder="000.000.000-00"
              value={signerTaxId}
              onChange={(e) => setSignerTaxId(e.target.value)}
              required
            />
            <SignaturePad onSave={(data) => setSignatureData(data)} />
          </CardContent>
        </Card>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        <Button
          type="submit"
          variant={approved ? "primary" : "danger"}
          isLoading={isSubmitting}
          size="md"
        >
          {approved ? "Aprovar orçamento" : "Registrar Rejeição"}
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
