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
import { deliverToCustomerAction } from "@/_app/actions/phase3-flow.actions";
import { customerDeliverySchema } from "../model/contracts";
import { defaultDeliveredItemIds, isAlreadyDeliveredItem } from "../model/delivery-selection";

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  items: ReadonlyArray<{ id: string; description: string; quantity: number }>;
  alreadyDeliveredItemIds: ReadonlyArray<string>;
  rowVersion: number;
}>;

function dataUrlToFile(dataUrl: string): File {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new File([buffer], "signature.png", { type: "image/png" });
}

export function CustomerDeliveryPage({
  collectionId,
  officialCode,
  items,
  alreadyDeliveredItemIds,
  rowVersion,
}: Props) {
  const router = useRouter();
  const [deliveredItemIds, setDeliveredItemIds] = useState<string[]>(() => [...defaultDeliveredItemIds()]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverTaxId, setReceiverTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function toggleItem(itemId: string): void {
    if (isAlreadyDeliveredItem(itemId, alreadyDeliveredItemIds)) return;
    setDeliveredItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  async function handleSubmit(): Promise<void> {
    if (isSubmitting) return;
    setErrorMsg(null);

    const selectedIds = deliveredItemIds.filter((itemId) => !isAlreadyDeliveredItem(itemId, alreadyDeliveredItemIds));
    if (selectedIds.length === 0) {
      setErrorMsg("Selecione ao menos um item para entrega.");
      return;
    }
    if (!signatureDataUrl) {
      setErrorMsg("Desenhe a assinatura antes de confirmar.");
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
      setErrorMsg(parsed.error.issues[0]?.message ?? "Revise os dados informados e tente novamente.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("expectedVersion", String(rowVersion));
    formData.set("receiverName", receiverName.trim());
    formData.set("receiverTaxId", receiverTaxId.trim());
    if (notes.trim() !== "") {
      formData.set("notes", notes.trim());
    }
    formData.set("deliveredItemIds", JSON.stringify(selectedIds));
    formData.set("signatureIntentId", signatureIntentId);
    formData.set("signature", dataUrlToFile(signatureDataUrl));

    const result = await deliverToCustomerAction(collectionId, formData);
    if (!result.ok) {
      setErrorMsg(result.error);
      setIsSubmitting(false);
      return;
    }

    startTransition(() => {
      router.push(`/coletas/${collectionId}` as Route);
    });
  }

  const selectableCount = items.filter((item) => !isAlreadyDeliveredItem(item.id, alreadyDeliveredItemIds)).length;
  const isPartialSelection = deliveredItemIds.length > 0 && deliveredItemIds.length < selectableCount;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Entrega ao cliente"
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
            Itens entregues
          </h2>
          {items.map((item) => {
            const alreadyDelivered = isAlreadyDeliveredItem(item.id, alreadyDeliveredItemIds);
            const isChecked = alreadyDelivered ? false : deliveredItemIds.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-3 shadow-xs transition-all ${
                  alreadyDelivered
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer active:scale-[0.99]"
                }`}
              >
                <span className="min-w-0 break-words text-[13px] font-medium text-[var(--color-text-primary)]">
                  {item.description}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">{item.quantity}x</span>
                  {alreadyDelivered ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      já entregue
                    </span>
                  ) : null}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    disabled={isSubmitting || alreadyDelivered}
                    aria-label={alreadyDelivered ? `${item.description} já entregue` : item.description}
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                </span>
              </label>
            );
          })}
        </section>

        {isPartialSelection ? (
          <p className="text-center text-[12px] font-semibold text-[var(--color-text-muted)]">
            {deliveredItemIds.length} de {selectableCount} itens serão entregues
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
            disabled={isSubmitting}
            required
          />
          <Input
            label="CPF/CNPJ de quem recebeu"
            placeholder="000.000.000-00"
            inputMode="numeric"
            value={receiverTaxId}
            onChange={(event) => setReceiverTaxId(event.target.value)}
            disabled={isSubmitting}
            required
          />
          <Input
            label="Observações (opcional)"
            placeholder="Ex.: entregue na recepção"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            disabled={isSubmitting}
          />
        </section>

        <Card className="flex flex-col gap-3 bg-[var(--color-card-bg)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Assinatura de quem recebeu
          </h2>
          <SignaturePad
            onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
            onClear={() => setSignatureDataUrl(null)}
            disabled={isSubmitting}
          />
        </Card>

        <Button variant="primary" size="md" isLoading={isSubmitting || isPending} onClick={() => void handleSubmit()}>
          Confirmar entrega
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
