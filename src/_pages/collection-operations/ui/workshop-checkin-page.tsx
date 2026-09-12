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
import {
  arrivalCounterLabel,
  arrivalStatusFromSegment,
  payloadConditionForSegment,
  payloadQuantityForSegment,
  type ArrivalUiSegment,
} from "../model/arrival-status";
import { ArrivalSegment } from "./arrival-segment";

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  collectionItems: ReadonlyArray<{ id: string; description: string; quantity: number }>;
  rowVersion: number;
}>;

type ItemRow = Readonly<{
  itemId: string;
  segment: ArrivalUiSegment;
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
      segment: "conferido",
      quantityObserved: String(item.quantity),
      conditionObserved: "",
      divergenceNotes: "",
    })),
  );
  const [administratorName, setAdministratorName] = useState("");
  const [administratorTaxId, setAdministratorTaxId] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const itemSourceById = new Map<string, { description: string; quantity: number }>(
    collectionItems.map((item) => [item.id, { description: item.description, quantity: item.quantity }]),
  );
  const missingCount = items.filter((row) => row.segment === "nao_chegou").length;

  function updateItem(itemId: string, patch: Partial<Omit<ItemRow, "itemId">>): void {
    setItems((current) => current.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row)));
  }

  function changeSegment(itemId: string, segment: ArrivalUiSegment): void {
    const source = itemSourceById.get(itemId);
    if (segment === "nao_chegou") {
      updateItem(itemId, { segment, quantityObserved: "0", conditionObserved: "" });
      return;
    }
    updateItem(itemId, { segment, quantityObserved: String(source?.quantity ?? 1) });
  }

  async function handleSubmit(): Promise<void> {
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!signatureDataUrl) {
      setErrorMsg("Desenhe a assinatura antes de confirmar.");
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
      items: items.map((row) => {
        const arrivalStatus = arrivalStatusFromSegment(row.segment);
        if (arrivalStatus === "missing") {
          return {
            itemId: row.itemId,
            itemDescription: descriptionById.get(row.itemId) ?? "",
            arrivalStatus,
            quantityObserved: 0,
            conditionObserved: "nao_recebido",
            divergenceNotes: row.divergenceNotes.trim(),
          };
        }
        return {
          itemId: row.itemId,
          itemDescription: descriptionById.get(row.itemId) ?? "",
          arrivalStatus,
          quantityObserved: payloadQuantityForSegment(row.segment, Number(row.quantityObserved)),
          conditionObserved: payloadConditionForSegment(row.segment, row.conditionObserved),
          divergenceNotes: row.divergenceNotes.trim() === "" ? null : row.divergenceNotes.trim(),
        };
      }),
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
        subtitle="Obrigatória · item por item"
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg ? (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,white)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">
            {errorMsg}
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-[22px] font-semibold leading-8 text-[var(--color-text-primary)]">Conferir item a item</h2>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {officialCode ? <span>{officialCode} · </span> : null}
            <span>{arrivalCounterLabel(items.length, missingCount)}</span>
          </p>
          {items.map((row) => {
            const source = itemSourceById.get(row.itemId);
            if (!source) return null;
            const isMissing = row.segment === "nao_chegou";
            const pillLabel = row.segment === "nao_chegou" ? "Não chegou" : row.segment === "divergencia" ? "Divergência" : "Conferido";
            return (
              <div
                key={row.itemId}
                className={`flex flex-col gap-2.5 rounded-[16px] border bg-[var(--color-card-bg)] p-4 shadow-xs ${
                  isMissing ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-[16px] font-semibold text-[var(--color-text-primary)]">
                    {source.description}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--color-text-muted)]">
                    Esperado: {source.quantity}x
                  </span>
                </div>
                <ArrivalSegment
                  value={row.segment}
                  disabled={isSubmitting}
                  onChange={(segment) => changeSegment(row.itemId, segment)}
                />
                {isMissing ? (
                  <>
                    <div className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5">
                      <span className="text-[12px] text-[var(--color-text-muted)]">Qtd observada</span>
                      <span className="text-[14px] font-semibold text-[var(--color-danger)]">0</span>
                    </div>
                    <p className="text-[12px] leading-4 text-[var(--color-text-muted)]">
                      Este item permanece na guia; não entra em orçamento, progresso nem entrega.
                    </p>
                    <Input
                      label="Motivo / observações *"
                      placeholder="Não veio na carga / não descarregado"
                      value={row.divergenceNotes}
                      onChange={(event) => updateItem(row.itemId, { divergenceNotes: event.target.value })}
                      maxLength={1000}
                      disabled={isSubmitting}
                      required
                      className="border-[var(--color-danger)] focus:border-[var(--color-danger)]"
                    />
                  </>
                ) : (
                  <>
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
                      label={row.segment === "divergencia" ? "Observações de divergência *" : "Observações de divergência (opcional)"}
                      placeholder="Ex.: riscos no acabamento"
                      value={row.divergenceNotes}
                      onChange={(event) => updateItem(row.itemId, { divergenceNotes: event.target.value })}
                      maxLength={1000}
                      disabled={isSubmitting}
                    />
                  </>
                )}
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1.5 text-[12px] font-semibold ${
                    isMissing
                      ? "bg-[color-mix(in_srgb,var(--color-danger)_12%,white)] text-[var(--color-danger)]"
                      : "bg-[var(--color-surface-green)] text-[var(--color-primary)]"
                  }`}
                >
                  {pillLabel}
                </span>
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-muted)]">Administrador responsável</h2>
          <Input
            label="Nome do administrador *"
            placeholder="Ex.: Maria Souza"
            value={administratorName}
            onChange={(event) => setAdministratorName(event.target.value)}
            maxLength={160}
            disabled={isSubmitting}
            required
          />
          <Input
            label="CPF/CNPJ do administrador *"
            placeholder="000.000.000-00"
            inputMode="numeric"
            value={administratorTaxId}
            onChange={(event) => setAdministratorTaxId(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </section>

        <Card className="flex flex-col gap-3 bg-[var(--color-card-bg)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-muted)]">Assinatura do administrador</h2>
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
