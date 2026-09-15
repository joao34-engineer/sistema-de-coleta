"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { signatureDataUrlToPngFile } from "@/shared/lib/file/signature-data-url-to-png-file";
import { deliverToCustomerAction } from "../api/actions";
import { customerDeliverySchema } from "../model/contracts";
import { useWorkshopHubSubmit } from "../model/use-workshop-hub-submit";
import {
  defaultDeliveredItemIds,
  isAlreadyDeliveredItem,
  isDeliverableItem,
  type ServiceOrderItemProgress,
} from "../model/delivery-selection";

type DeliveryPageItem = Readonly<{
  id: string;
  description: string;
  quantity: number;
  serviceOrderStatus: ServiceOrderItemProgress;
}>;

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  items: ReadonlyArray<DeliveryPageItem>;
  alreadyDeliveredItemIds: ReadonlyArray<string>;
  rowVersion: number;
}>;

export function CustomerDeliveryPage({
  collectionId,
  officialCode,
  items,
  alreadyDeliveredItemIds,
  rowVersion,
}: Props) {
  const [deliveredItemIds, setDeliveredItemIds] = useState<string[]>(() => [...defaultDeliveredItemIds()]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverTaxId, setReceiverTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const { error: errorMsg, isPending, setError, submit } = useWorkshopHubSubmit(collectionId);

  function toggleItem(itemId: string): void {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || !isDeliverableItem(item.serviceOrderStatus, item.id, alreadyDeliveredItemIds)) {
      return;
    }
    setDeliveredItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function handleSubmit(): void {
    if (isPending) return;
    setError(null);

    const selectedIds = deliveredItemIds.filter((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId);
      return item !== undefined && isDeliverableItem(item.serviceOrderStatus, item.id, alreadyDeliveredItemIds);
    });
    if (selectedIds.length === 0) {
      setError("Selecione ao menos um item para entrega.");
      return;
    }
    if (!signatureDataUrl) {
      setError("Desenhe a assinatura antes de confirmar.");
      return;
    }

    const signatureIntentId = crypto.randomUUID();
    const parsed = customerDeliverySchema.safeParse({
      collectionId,
      expectedVersion: rowVersion,
      deliveredItemIds: selectedIds,
      receiverName,
      receiverTaxId,
      notes: notes.trim() === "" ? undefined : notes.trim(),
      signatureIntentId,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados informados e tente novamente.");
      return;
    }

    const signaturePng = signatureDataUrl;
    submit(async () => {
      const formData = new FormData();
      formData.set("expectedVersion", String(rowVersion));
      formData.set("receiverName", receiverName.trim());
      formData.set("receiverTaxId", receiverTaxId.trim());
      if (notes.trim() !== "") {
        formData.set("notes", notes.trim());
      }
      formData.set("deliveredItemIds", JSON.stringify(selectedIds));
      formData.set("signatureIntentId", signatureIntentId);
      formData.set("signature", signatureDataUrlToPngFile(signaturePng));
      return deliverToCustomerAction(collectionId, formData);
    });
  }

  const selectedCount = deliveredItemIds.filter((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    return item !== undefined && isDeliverableItem(item.serviceOrderStatus, item.id, alreadyDeliveredItemIds);
  }).length;
  const isPartialSelection = selectedCount > 0 && selectedCount < items.length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Entrega ao cliente"
        subtitle="Somente itens prontos"
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg ? (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,white)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">
            {errorMsg}
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-[24px] font-semibold leading-8 text-[var(--color-text-primary)]">
            Selecione os itens para entrega
          </h2>
          {officialCode ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">Guia {officialCode}</p>
          ) : null}
          {items.map((item) => {
            const alreadyDelivered = isAlreadyDeliveredItem(item.id, alreadyDeliveredItemIds);
            const continuesInRepair = !alreadyDelivered && item.serviceOrderStatus === "em_reparo";
            const deliverable = isDeliverableItem(item.serviceOrderStatus, item.id, alreadyDeliveredItemIds);
            const isChecked = deliverable && deliveredItemIds.includes(item.id);
            const rowLabel = alreadyDelivered
              ? `${item.description} já entregue`
              : continuesInRepair
                ? `${item.description} Continua em reparo`
                : deliverable
                  ? `${item.description} Pronta para retirada`
                  : item.description;
            return (
              <label
                key={item.id}
                className={`flex min-h-[88px] items-center justify-between gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-4 shadow-xs transition-all ${
                  deliverable
                    ? "cursor-pointer active:scale-[0.99]"
                    : "cursor-not-allowed opacity-70"
                }`}
              >
                <span className="min-w-0 break-words text-[13px] font-medium text-[var(--color-text-primary)]">
                  {item.description}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {deliverable ? (
                    <span className="rounded-full bg-[var(--color-surface-green)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary-strong)]">
                      Pronto
                    </span>
                  ) : null}
                  <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">{item.quantity}x</span>
                  {alreadyDelivered ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      já entregue
                    </span>
                  ) : continuesInRepair ? (
                    <span className="text-[11px] font-semibold tracking-wide text-[var(--color-text-muted)]">
                      Continua em reparo
                    </span>
                  ) : deliverable ? (
                    <span className="text-[11px] font-semibold tracking-wide text-[var(--color-text-muted)]">
                      Pronta para retirada
                    </span>
                  ) : null}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    disabled={isPending || !deliverable}
                    aria-label={rowLabel}
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                </span>
              </label>
            );
          })}
        </section>

        {isPartialSelection ? (
          <p className="text-center text-[12px] font-semibold text-[var(--color-text-muted)]">
            {selectedCount} de {items.length} itens serão entregues
          </p>
        ) : null}

        <section className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Quem recebeu
          </h2>
          <Input
            label="Nome de quem recebeu"
            placeholder="Ex.: Maria Souza"
            value={receiverName}
            onChange={(event) => setReceiverName(event.target.value)}
            maxLength={160}
            disabled={isPending}
            required
          />
          <Input
            label="CPF/CNPJ de quem recebeu"
            placeholder="000.000.000-00"
            inputMode="numeric"
            value={receiverTaxId}
            onChange={(event) => setReceiverTaxId(event.target.value)}
            disabled={isPending}
            required
          />
          <Input
            label="Observações (opcional)"
            placeholder="Ex.: entregue na recepção"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            disabled={isPending}
          />
        </section>

        <Card className="flex flex-col gap-3 bg-[var(--color-card-bg)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Assinatura de quem recebeu
          </h2>
          <SignaturePad
            onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
            onClear={() => setSignatureDataUrl(null)}
            disabled={isPending}
          />
        </Card>

        <Button variant="primary" size="md" isLoading={isPending} className="h-[52px]" onClick={() => void handleSubmit()}>
          Confirmar entrega
        </Button>
      </div>

    </main>
  );
}
