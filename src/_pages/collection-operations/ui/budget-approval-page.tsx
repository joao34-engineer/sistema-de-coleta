"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
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
      <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold border ${
            decisionOutcome === "approved"
              ? "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] border-[var(--color-primary)]"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {decisionOutcome === "approved" ? "✓" : "✕"}
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {decisionOutcome === "approved" ? "Orçamento Aprovado!" : "Orçamento Não Aprovado"}
        </h1>
        <p className="text-xs text-[var(--color-muted)]">
          Decisão registrada para a coleta {officialCode ?? collectionId} por {signerName}.
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
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Aprovação de Orçamento</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Análise financeira da coleta {officialCode ?? collectionId}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        {/* Total Summary Header */}
        <Card className="bg-[var(--color-surface-neutral)] border-[var(--color-border)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Cliente: {customerName ?? "Cliente MJT"}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Items Cost Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Resumo dos Serviços</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => {
              const itemTotal = it.laborCostBrl + it.partsCostBrl;
              return (
                <div key={it.id} className="rounded-xl border border-[var(--color-border)] p-3 space-y-1 text-xs bg-white">
                  <div className="flex items-center justify-between font-semibold text-gray-900">
                    <span>Item #{idx + 1}: {it.description}</span>
                    <span className="text-[var(--color-primary-strong)]">
                      {itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Mão de Obra: R$ {it.laborCostBrl.toFixed(2)} • Peças: R$ {it.partsCostBrl.toFixed(2)} • Prazo: {it.estimatedDays} dias
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Decision Toggle */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Decisão do Cliente / Gestor</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setApproved(true)}
                className={`h-11 rounded-xl font-bold text-xs border transition-all ${
                  approved
                    ? "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                ✓ Aprovar Orçamento
              </button>
              <button
                type="button"
                onClick={() => setApproved(false)}
                className={`h-11 rounded-xl font-bold text-xs border transition-all ${
                  !approved
                    ? "bg-red-50 text-red-700 border-red-300 ring-2 ring-red-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                ✕ Rejeitar Orçamento
              </button>
            </div>

            {!approved && (
              <div>
                <label htmlFor="rejectionReason" className="mb-1 block text-xs font-medium text-red-700">
                  Motivo da Não Aprovação (Obrigatório)
                </label>
                <textarea
                  id="rejectionReason"
                  rows={2}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Valor acima do orçamento aprovado pela diretoria..."
                  className="w-full rounded-xl border border-red-300 p-2.5 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signer Credentials & Signature */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Identificação do Signatário</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="signerName" className="mb-1 block text-xs font-medium text-gray-700">
                Nome do Responsável
              </label>
              <input
                id="signerName"
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="signerTaxId" className="mb-1 block text-xs font-medium text-gray-700">
                CPF ou CNPJ do Responsável
              </label>
              <input
                id="signerTaxId"
                type="text"
                required
                value={signerTaxId}
                onChange={(e) => setSignerTaxId(e.target.value)}
                placeholder="000.000.000-00"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Assinatura do Responsável</label>
              <SignaturePad onSave={(data) => setSignatureData(data)} />
              {signatureData && (
                <p className="mt-2 text-xs text-[var(--color-primary-strong)] font-medium">
                  ✓ Assinatura capturada com sucesso!
                </p>
              )}
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
          variant={approved ? "primary" : "danger"}
          isLoading={isSubmitting}
          className="w-full text-xs h-11 rounded-xl font-semibold"
        >
          {approved ? "Confirmar Aprovação do Orçamento" : "Registrar Não Aprovação"}
        </Button>
      </form>
    </div>
  );
}
