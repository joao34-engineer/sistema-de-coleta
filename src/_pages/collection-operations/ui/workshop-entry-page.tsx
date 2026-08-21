"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { SignaturePad } from "@/shared/ui/signature-pad";

export interface WorkshopItemCheckInState {
  itemId: string;
  quantityObserved: number;
  conditionObserved: string;
  divergenceNotes: string;
}

export interface WorkshopEntryProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    condition: string | null;
  }>;
}

export function WorkshopEntryPage({ collectionId, officialCode, expectedVersion, items }: WorkshopEntryProps) {
  const [administratorName, setAdministratorName] = useState("");
  const [administratorTaxId, setAdministratorTaxId] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [itemCheckIns, setItemCheckIns] = useState<WorkshopItemCheckInState[]>(
    items.map((it) => ({
      itemId: it.id,
      quantityObserved: it.quantity,
      conditionObserved: it.condition ?? "Recebido sem avarias visíveis",
      divergenceNotes: "",
    }))
  );

  const handleItemChange = <K extends keyof WorkshopItemCheckInState>(
    index: number,
    field: K,
    value: WorkshopItemCheckInState[K]
  ) => {
    setItemCheckIns((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!administratorName.trim()) {
      setErrorMsg("Informe o nome do administrador responsavel.");
      return;
    }
    if (!administratorTaxId.trim()) {
      setErrorMsg("Informe o CPF ou CNPJ do administrador.");
      return;
    }
    if (!signatureData) {
      setErrorMsg("Assinatura digital do administrador é obrigatória.");
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] text-2xl font-bold border border-[var(--color-primary)]">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-900">Entrada na Oficina Registrada!</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Os itens da coleta {officialCode ?? collectionId} foram recebidos na oficina MJT.
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
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Entrada na Oficina MJT</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Conferência item a item dos equipamentos recebidos ({officialCode ?? collectionId})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        {/* Administrator Credentials */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Administrador Responsável pelo Recebimento</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="adminName" className="mb-1 block text-xs font-medium text-gray-700">
                Nome Completo do Administrador
              </label>
              <input
                id="adminName"
                type="text"
                required
                value={administratorName}
                onChange={(e) => setAdministratorName(e.target.value)}
                placeholder="Ex: Carlos Eduardo da Silva"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="adminTaxId" className="mb-1 block text-xs font-medium text-gray-700">
                CPF ou CNPJ MJT
              </label>
              <input
                id="adminTaxId"
                type="text"
                required
                value={administratorTaxId}
                onChange={(e) => setAdministratorTaxId(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Item by Item Check-in */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Conferência dos Itens ({items.length})</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((it, idx) => {
              const currentCheckIn = itemCheckIns[idx];
              if (!currentCheckIn) return null;

              return (
                <div key={it.id} className="rounded-xl border border-[var(--color-border)] p-3 space-y-2 bg-white text-xs">
                  <p className="font-bold text-gray-900">Item #{idx + 1}: {it.description}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Qtd Observada</label>
                      <input
                        type="number"
                        min="1"
                        value={currentCheckIn.quantityObserved}
                        onChange={(e) => handleItemChange(idx, "quantityObserved", Number(e.target.value))}
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Estado Observado</label>
                      <input
                        type="text"
                        value={currentCheckIn.conditionObserved}
                        onChange={(e) => handleItemChange(idx, "conditionObserved", e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-600">Notas de Divergência / Avarias (se houver)</label>
                    <input
                      type="text"
                      value={currentCheckIn.divergenceNotes}
                      onChange={(e) => handleItemChange(idx, "divergenceNotes", e.target.value)}
                      placeholder="Sem divergências identificadas"
                      className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Administrator Signature Pad */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Assinatura do Administrador MJT</h2>
          </CardHeader>
          <CardContent>
            <SignaturePad onSave={(data) => setSignatureData(data)} />
            {signatureData && (
              <p className="mt-2 text-xs text-[var(--color-primary-strong)] font-medium">
                ✓ Assinatura capturada com sucesso!
              </p>
            )}
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
          Confirmar Recebimento na Oficina
        </Button>
      </form>
    </div>
  );
}
