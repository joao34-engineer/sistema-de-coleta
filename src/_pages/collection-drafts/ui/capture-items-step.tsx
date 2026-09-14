"use client";

import { useState } from "react";
import type { Route } from "next";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
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
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-border)]" />
        </div>
        <SyncStatusChip state={status} lastError={draft?.lastError ?? null} />
      </div>
      <div className="flex flex-col gap-6 px-6 pt-6">
        <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">Registre tudo o que foi entregue.</h2>
        {displayError ? <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">{displayError}</div> : null}
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">{String(index + 1).padStart(2, "0")}</span>
                  <Badge status="ready">{item.condition ?? "Usado"}</Badge>
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">{item.description}</h3>
                <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
                  {item.quantity} un. · {item.notes || "Foto opcional"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button type="button" onClick={() => setEditingItem(toDto(item))} className="text-[11px] font-semibold text-[var(--color-primary-strong)] hover:underline">
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
                  className="text-[11px] font-semibold text-[#ba5b52] hover:underline"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={() => setIsAddingNew(true)} className="h-[52px] rounded-[12px] text-[14px] font-semibold">
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
      <MobileBottomNav />
    </main>
  );
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
