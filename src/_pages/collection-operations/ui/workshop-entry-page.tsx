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
      setErrorMsg("Informe o nome do administrador responsável.");
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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center flex flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] text-2xl font-bold border border-[var(--color-primary)]">
          ✓
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          Entrada na Oficina Registrada!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Os itens da coleta {officialCode ?? collectionId} foram recebidos na oficina MJT.
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
        title="Entrada na oficina"
        subtitle="Obrigatória · item por item"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            Conferir antes de iniciar o reparo.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Administrator Credentials */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Administrador Responsável pelo Recebimento
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="Nome do Administrador *"
              placeholder="Ex: Carlos Eduardo da Silva"
              value={administratorName}
              onChange={(e) => setAdministratorName(e.target.value)}
              required
            />
            <Input
              label="CPF ou CNPJ MJT *"
              placeholder="00.000.000/0000-00"
              value={administratorTaxId}
              onChange={(e) => setAdministratorTaxId(e.target.value)}
              required
            />
          </CardContent>
        </Card>

        {/* Item by Item Check-in */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Conferência dos Itens ({items.length})
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {items.map((it, idx) => {
              const currentCheckIn = itemCheckIns[idx];
              if (!currentCheckIn) return null;

              return (
                <div
                  key={it.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-[var(--color-border)] p-3 text-[12px]"
                >
                  <p className="font-semibold text-[var(--color-text)]">
                    Item #{idx + 1}: {it.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Qtd Observada"
                      type="number"
                      min="1"
                      value={currentCheckIn.quantityObserved}
                      onChange={(e) => handleItemChange(idx, "quantityObserved", Number(e.target.value))}
                    />
                    <Input
                      label="Estado Observado"
                      value={currentCheckIn.conditionObserved}
                      onChange={(e) => handleItemChange(idx, "conditionObserved", e.target.value)}
                    />
                  </div>
                  <Input
                    label="Notas de Divergência (se houver)"
                    placeholder="Sem divergências"
                    value={currentCheckIn.divergenceNotes}
                    onChange={(e) => handleItemChange(idx, "divergenceNotes", e.target.value)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Administrator Signature Pad */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Assinatura do Administrador MJT *
            </h3>
          </CardHeader>
          <CardContent>
            <SignaturePad onSave={(data) => setSignatureData(data)} />
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          size="md"
        >
          Confirmar entrada na oficina
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
