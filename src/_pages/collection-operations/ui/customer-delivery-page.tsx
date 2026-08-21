"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { SignaturePad } from "@/shared/ui/signature-pad";

export interface CustomerDeliveryProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  customerName: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    status: "pronto" | "em_reparo" | "entregue";
  }>;
}

export function CustomerDeliveryPage({
  collectionId,
  officialCode,
  expectedVersion,
  customerName,
  items,
}: CustomerDeliveryProps) {
  // Pre-select items that are ready
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    items.filter((i) => i.status === "pronto").map((i) => i.id)
  );
  const [receiverName, setReceiverName] = useState(customerName ?? "");
  const [receiverTaxId, setReceiverTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<"delivered" | "partial_delivery" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isPartial = selectedItemIds.length < items.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedItemIds.length === 0) {
      setErrorMsg("Selecione ao menos um equipamento para entrega.");
      return;
    }
    if (!receiverName.trim()) {
      setErrorMsg("Informe o nome de quem está recebendo os equipamentos.");
      return;
    }
    if (!receiverTaxId.trim()) {
      setErrorMsg("Informe o CPF ou CNPJ do recebedor.");
      return;
    }
    if (!signatureData) {
      setErrorMsg("A assinatura digital do recebedor é obrigatória.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setDeliveryResult(isPartial ? "partial_delivery" : "delivered");
    }, 600);
  };

  if (deliveryResult) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] text-2xl font-bold border border-[var(--color-primary)]">
          📦
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {deliveryResult === "delivered" ? "Entrega Total Concluída!" : "Entrega Parcial Registrada!"}
        </h1>
        <p className="text-xs text-[var(--color-muted)]">
          {selectedItemIds.length} de {items.length} itens entregues para {receiverName}.
          {deliveryResult === "partial_delivery" && (
            <span className="block mt-1 font-semibold text-orange-700">
              Os itens restantes permanecem pendentes na oficina até nova entrega.
            </span>
          )}
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
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Entrega de Equipamentos</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Termo de entrega com assinatura ({officialCode ?? collectionId})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        {/* Item Selection Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Itens para Entrega</h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isPartial ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>
                {isPartial ? "Entrega Parcial" : "Entrega Total"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((it) => {
              const isChecked = selectedItemIds.includes(it.id);
              return (
                <label
                  key={it.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "border-[var(--color-primary)] bg-[var(--color-surface-green)]/40"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItemSelection(it.id)}
                    className="mt-0.5 h-4 w-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-gray-900">{it.description} (Qtd: {it.quantity})</p>
                    <p className="text-[11px] text-gray-500">Status Atual: {it.status === "pronto" ? "Pronto" : it.status === "entregue" ? "Entregue Anteriormente" : "Em Reparo"}</p>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {/* Receiver Credentials */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Dados do Recebedor</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="receiverName" className="mb-1 block text-xs font-medium text-gray-700">
                Nome do Recebedor
              </label>
              <input
                id="receiverName"
                type="text"
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Nome completo..."
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="receiverTaxId" className="mb-1 block text-xs font-medium text-gray-700">
                CPF ou CNPJ do Recebedor
              </label>
              <input
                id="receiverTaxId"
                type="text"
                required
                value={receiverTaxId}
                onChange={(e) => setReceiverTaxId(e.target.value)}
                placeholder="000.000.000-00"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="deliveryNotes" className="mb-1 block text-xs font-medium text-gray-700">
                Observações de Entrega (Opcional)
              </label>
              <input
                id="deliveryNotes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Entregue com manuais, cabos..."
                className="h-10 w-full rounded-xl border border-[var(--color-border)] px-3 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Receiver Signature Pad */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Assinatura do Termo de Recebimento</h2>
          </CardHeader>
          <CardContent>
            <SignaturePad onSave={(data) => setSignatureData(data)} />
            {signatureData && (
              <p className="mt-2 text-xs text-[var(--color-primary-strong)] font-medium">
                ✓ Assinatura de aceite capturada com sucesso!
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
          {isPartial ? "Registrar Entrega Parcial" : "Finalizar Entrega Completa"}
        </Button>
      </form>
    </div>
  );
}
