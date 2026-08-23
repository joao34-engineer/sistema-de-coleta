"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { workshopCheckInAction } from "@/_app/actions/phase3-flow.actions";
import { workshopCheckInSchema } from "../model/contracts";

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  collectionItems: ReadonlyArray<{ id: string; description: string; quantity: number }>;
  rowVersion: number;
}>;

type ItemRow = Readonly<{
  itemId: string;
  quantityObserved: string;
  conditionObserved: string;
  divergenceNotes: string;
}>;

function dataUrlToFile(dataUrl: string): File {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new File([buffer], "signature.png", { type: "image/png" });
}

export function WorkshopCheckInPage({ collectionId, officialCode, collectionItems, rowVersion }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>(() =>
    collectionItems.map((item) => ({
      itemId: item.id,
      quantityObserved: String(item.quantity),
      conditionObserved: "",
      divergenceNotes: "",
    }))
  );
  const [administratorName, setAdministratorName] = useState("");
  const [administratorTaxId, setAdministratorTaxId] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const itemSourceById = new Map<string, { description: string; quantity: number }>(
    collectionItems.map((item) => [item.id, { description: item.description, quantity: item.quantity }])
  );

  function updateItem(itemId: string, patch: Partial<Omit<ItemRow, "itemId">>): void {
    setItems((current) => current.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(): Promise<void> {
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!signatureDataUrl) {
      setErrorMsg("Desenhe a assinatura antes de confirmar.");
      return;
    }
    if (items.some((row) => !(Number(row.quantityObserved) > 0))) {
      setErrorMsg("Informe uma quantidade observada maior que zero para todos os itens.");
      return;
    }

    const descriptionById = new Map<string, string>(collectionItems.map((item) => [item.id, item.description]));
    const signatureIntentId = crypto.randomUUID();
    const parsed = workshopCheckInSchema.safeParse({
      collectionId,
      expectedVersion: rowVersion,
      administratorName,
      administratorTaxId,
      signatureIntentId,
      items: items.map((row) => ({
        itemId: row.itemId,
        itemDescription: descriptionById.get(row.itemId) ?? "",
        quantityObserved: Number(row.quantityObserved),
        conditionObserved: row.conditionObserved.trim(),
        divergenceNotes: row.divergenceNotes.trim() === "" ? null : row.divergenceNotes.trim(),
      })),
    });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Revise os dados informados e tente novamente.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("expectedVersion", String(rowVersion));
    formData.set("administratorName", administratorName.trim());
    formData.set("administratorTaxId", administratorTaxId.trim());
    formData.set("items", JSON.stringify(parsed.data.items));
    formData.set("signatureIntentId", signatureIntentId);
    formData.set("signature", dataUrlToFile(signatureDataUrl));

    const result = await workshopCheckInAction(collectionId, formData);
    if (!result.ok) {
      setErrorMsg(result.error);
      setIsSubmitting(false);
      return;
    }

    startTransition(() => {
      router.push(`/coletas/${collectionId}` as Route);
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Entrada na oficina"
        subtitle={officialCode ?? "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg ? (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Itens recebidos
          </h2>
          {items.map((row) => {
            const source = itemSourceById.get(row.itemId);
            if (!source) return null;
            return (
              <div
                key={row.itemId}
                className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-[13px] font-medium text-[var(--color-text-primary)]">
                    {source.description}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--color-text-muted)]">
                    Esperado: {source.quantity}x
                  </span>
                </div>
                <Input
                  label="Quantidade observada"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={row.quantityObserved}
                  onChange={(event) => updateItem(row.itemId, { quantityObserved: event.target.value })}
                  disabled={isSubmitting}
                  required
                />
                <Input
                  label="Condição observada"
                  placeholder="Ex.: sem avarias"
                  value={row.conditionObserved}
                  onChange={(event) => updateItem(row.itemId, { conditionObserved: event.target.value })}
                  disabled={isSubmitting}
                  required
                />
                <Input
                  label="Observações de divergência (opcional)"
                  placeholder="Ex.: riscos no acabamento"
                  value={row.divergenceNotes}
                  onChange={(event) => updateItem(row.itemId, { divergenceNotes: event.target.value })}
                  maxLength={1000}
                  disabled={isSubmitting}
                />
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Administrador responsável
          </h2>
          <Input
            label="Nome do administrador"
            placeholder="Ex.: Maria Souza"
            value={administratorName}
            onChange={(event) => setAdministratorName(event.target.value)}
            maxLength={160}
            disabled={isSubmitting}
            required
          />
          <Input
            label="CPF/CNPJ do administrador"
            placeholder="000.000.000-00"
            inputMode="numeric"
            value={administratorTaxId}
            onChange={(event) => setAdministratorTaxId(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </section>

        <Card className="flex flex-col gap-3 bg-[var(--color-card-bg)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Assinatura do administrador
          </h2>
          <SignaturePad
            onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
            onClear={() => setSignatureDataUrl(null)}
            disabled={isSubmitting}
          />
        </Card>

        <Button
          variant="primary"
          size="md"
          isLoading={isSubmitting || isPending}
          className="h-[52px]"
          onClick={() => void handleSubmit()}
        >
          Confirmar entrada
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
