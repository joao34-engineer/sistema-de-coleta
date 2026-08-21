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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center flex flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef8f2] text-[#31674c] text-2xl font-bold border border-[#4c916f]">
          📦
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          {deliveryResult === "delivered" ? "Entrega Concluída!" : "Entrega Parcial Registrada!"}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          {selectedItemIds.length} de {items.length} itens entregues para {receiverName}.
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
        title="Entrega final"
        subtitle="Termo e assinatura"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            Recibo de devolução.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId}
          </p>
        </div>

        {/* Item Selection Card */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Itens para Devolução ({selectedItemIds.length}/{items.length})
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {items.map((it) => {
              const isChecked = selectedItemIds.includes(it.id);
              return (
                <label
                  key={it.id}
                  className={`flex items-start gap-3 rounded-[12px] border p-3 cursor-pointer transition-all ${
                    isChecked
                      ? "border-[var(--color-primary)] bg-[var(--color-surface-green)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItemSelection(it.id)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  <div className="text-[12px]">
                    <p className="font-semibold text-[var(--color-text)]">
                      {it.quantity}x {it.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {/* Receiver Credentials */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Dados do Recebedor
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="Nome de quem recebe *"
              placeholder="Nome completo..."
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              required
            />
            <Input
              label="CPF ou CNPJ do recebedor *"
              placeholder="000.000.000-00"
              value={receiverTaxId}
              onChange={(e) => setReceiverTaxId(e.target.value)}
              required
            />
            <Input
              label="Observações da entrega"
              placeholder="Entregue com cabo de força..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Receiver Signature Pad */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Assinatura do Recebedor *
            </h3>
          </CardHeader>
          <CardContent>
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
          variant="primary"
          isLoading={isSubmitting}
          size="md"
        >
          Confirmar entrega ao cliente
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
