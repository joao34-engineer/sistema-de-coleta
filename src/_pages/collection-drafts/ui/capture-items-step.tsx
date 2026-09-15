"use client";

import { useState } from "react";
import type { Route } from "next";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import type { CaptureActor, CaptureStep, SyncUxState } from "../model/capture-actor";
import type { DraftItemDTO } from "../model/draft";
import { addLocalItem, isBrowserOnline, removeLocalItem, updateLocalItem } from "../model/offline-capture";
import { ensureOfflineDraftStore } from "../model/offline-port";
import { runAuthenticatedDrain } from "../model/run-authenticated-drain";
import type { OfflineDraftRecord, OfflineItemRecord } from "../model/offline-records";
import { EditItemModal } from "./edit-item-modal";
import { SyncStatusChip } from "./sync-status-chip";

type Props = Readonly<{
  actor: CaptureActor;
  draftId: string;
  draft: OfflineDraftRecord | null;
  items: readonly OfflineItemRecord[];
  status: SyncUxState;
  displayError: string | null;
  onReload: () => void;
  onStep: (step: CaptureStep) => Promise<void>;
  onAwaitHydrate: () => Promise<void>;
}>;

export function CaptureItemsStep({
  actor,
  draftId,
  draft,
  items,
  status,
  displayError,
  onReload,
  onStep,
  onAwaitHydrate,
}: Props) {
  const [editingItem, setEditingItem] = useState<DraftItemDTO | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  async function persistItem(updatedData: {
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }) {
    await onAwaitHydrate();
    const store = await ensureOfflineDraftStore();
    if (editingItem) {
      const current = items.find((item) => item.id === editingItem.id);
      if (current) {
        await updateLocalItem({ store, actor, item: current, ...updatedData });
      }
    } else if (isAddingNew) {
      await addLocalItem({ store, actor, collectionId: draftId, ...updatedData });
    }
    setEditingItem(null);
    setIsAddingNew(false);
    onReload();
    if (isBrowserOnline()) {
      void runAuthenticatedDrain(actor).then(onReload);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Itens da coleta" subtitle={`Etapa 2 de 3 · ${items.length} itens`} backHref={"/coletas" as Route} />
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-border)]" />
        </div>
        <SyncStatusChip state={status} lastError={draft?.lastError ?? null} />
      </div>
      <div className="flex flex-col gap-6 px-6 pt-6">
        <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">Registre tudo o que foi entregue.</h2>
        {displayError ? <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">{displayError}</div> : null}
        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
            const condition = itemConditionPresentation(item.condition);
            return (
              <div
                key={item.id}
                className="relative w-full max-w-[342px] rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-xs"
              >
                <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-surface-green)] text-[12px] font-semibold text-[var(--color-primary-strong)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Badge status={condition.status}>{condition.label}</Badge>
                <h3 className="mt-2 pr-12 text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">
                  {item.description}
                </h3>
                <p className="text-[12px] font-normal leading-4 text-[var(--color-text-muted)]">
                  {item.quantity} {item.quantity === 1 ? "unidade" : "unidades"} · {item.notes || "Foto opcional"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(toDto(item))}
                    className="h-7 w-[60px] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[11px] font-semibold text-[var(--color-primary-strong)]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await onAwaitHydrate();
                        const store = await ensureOfflineDraftStore();
                        await removeLocalItem({ store, actor, item });
                        onReload();
                      })();
                    }}
                    className="h-7 rounded-[8px] px-2 text-[11px] font-semibold text-[var(--color-danger)]"
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsAddingNew(true)}
          className="h-[60px] max-w-[342px] rounded-[12px] border-0 bg-[var(--color-surface-green)] text-[14px] font-semibold text-[var(--color-primary-strong)] shadow-none"
        >
          + Adicionar item
        </Button>
        <Button type="button" variant="primary" disabled={items.length === 0} onClick={() => void onStep("revisao")} className="mt-2 h-[52px] rounded-[12px] text-[14px] font-semibold">
          Revisar coleta
        </Button>
      </div>
      {editingItem || isAddingNew ? (
        <EditItemModal
          isOpen
          item={editingItem ?? undefined}
          onClose={() => {
            setEditingItem(null);
            setIsAddingNew(false);
          }}
          onSave={persistItem}
        />
      ) : null}
    </main>
  );
}

function itemConditionPresentation(condition: string | null): Readonly<{
  label: string;
  status: "neutral" | "draft";
}> {
  if (condition === "Com Avaria") {
    return { label: "Avaria descrita", status: "draft" };
  }
  return { label: condition ?? "Usado", status: "neutral" };
}

function toDto(item: OfflineItemRecord): DraftItemDTO {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    condition: item.condition,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
