"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { isOfflineQuotaExceeded } from "@/shared/lib/offline";
import type { CaptureActor, CaptureStep, SyncUxState } from "../model/capture-actor";
import {
  addLocalItem,
  DEFAULT_ACCEPTANCE_TEXT,
  hydrateServerDraft,
  isBrowserOnline,
  asStoredTaxId,
  normalizeTaxId,
  removeLocalItem,
  saveLocalSignature,
  setDraftStep,
  updateLocalItem,
} from "../model/offline-capture";
import { offlineCopy } from "../model/offline-copy";
import { ensureOfflineDraftStore } from "../model/offline-port";
import { productionOfflineCommands } from "../model/production-offline-commands";
import { browserDrainLock, drainAllPending } from "../model/offline-runner";
import type { OfflineDraftRecord, OfflineItemRecord } from "../model/offline-records";
import { fetchDraftWithItemsAction } from "../api/actions";
import { NewCollectionPage } from "./new-collection-page";
import { SyncStatusChip } from "./sync-status-chip";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { EditItemModal } from "./edit-item-modal";
import type { DraftItemDTO } from "../model/draft";

type Props = Readonly<{
  actor: CaptureActor;
  resumeDraftId?: string;
  initialStep?: CaptureStep;
}>;

function uxState(online: boolean, syncStatus: OfflineDraftRecord["syncStatus"]): SyncUxState {
  if (syncStatus === "failed") return "failed";
  if (syncStatus === "syncing") return "syncing";
  if (syncStatus === "synced" && online) return "synced";
  if (online && syncStatus === "queued") return "online";
  return "saved_locally";
}

export function CollectionCapturePage({ actor, resumeDraftId, initialStep }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<CaptureStep>(initialStep ?? (resumeDraftId ? "itens" : "cliente"));
  const [draftId, setDraftId] = useState<string | null>(resumeDraftId ?? null);
  const [draft, setDraft] = useState<OfflineDraftRecord | null>(null);
  const [items, setItems] = useState<readonly OfflineItemRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [online, setOnline] = useState(isBrowserOnline());
  const [queuedDone, setQueuedDone] = useState(false);

  const reload = useCallback(async (id: string) => {
    const store = await ensureOfflineDraftStore();
    const local = await store.getDraft(id, actor.userId);
    if (local) {
      setDraft(local);
      setItems(await store.listItems(id, actor.userId));
      setStep(local.currentStep);
      setDraftId(local.id);
      return local;
    }
    if (!isBrowserOnline()) {
      setErrorMsg("Rascunho de coleta não encontrado.");
      return null;
    }
    const remote = await fetchDraftWithItemsAction(id);
    if (!remote.ok) {
      setErrorMsg("Rascunho de coleta não encontrado.");
      return null;
    }
    const hydrated = await hydrateServerDraft({
      store,
      actor,
      draft: remote.draft,
      items: remote.items,
      hasSignature: remote.hasSignature,
      step: initialStep ?? "itens",
      customer: {
        mode: "existing",
        customerId: remote.draft.customerId ?? id,
        displayName: remote.draft.responsibleName ?? "Cliente",
        taxId: asStoredTaxId(remote.draft.responsibleTaxId) ?? "00000000000",
        phone: "11000000000",
        street: remote.draft.collectionLocation === null ? null : remote.draft.collectionLocation.slice(0, 160),
      },
    });
    setDraft(hydrated);
    setItems(await store.listItems(id, actor.userId));
    setDraftId(hydrated.id);
    setStep(hydrated.currentStep);
    return hydrated;
  }, [actor, initialStep]);

  const drainIfOnline = useCallback(async (id?: string) => {
    if (!isBrowserOnline()) {
      return;
    }
    const store = await ensureOfflineDraftStore();
    await drainAllPending({
      store,
      commands: productionOfflineCommands,
      actor,
      lock: browserDrainLock(),
    });
    if (id) {
      await reload(id);
    }
  }, [actor, reload]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void drainIfOnline(draftId ?? undefined);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [draftId, drainIfOnline]);

  useEffect(() => {
    void (async () => {
      const store = await ensureOfflineDraftStore();
      await store.refreshSnapshot(actor.userId);
      if (resumeDraftId) {
        await reload(resumeDraftId);
      }
      await drainIfOnline(resumeDraftId);
    })();
  }, [actor.userId, resumeDraftId, reload, drainIfOnline]);

  const status = useMemo(() => uxState(online, draft?.syncStatus ?? "local"), [online, draft]);

  if (step === "cliente" || draftId === null) {
    return (
      <NewCollectionPage
        actor={actor}
        onCreated={(id) => {
          setDraftId(id);
          setStep("itens");
          void (async () => {
            await reload(id);
            await drainIfOnline(id);
          })();
        }}
      />
    );
  }

  return (
    <CaptureSteps
      actor={actor}
      draftId={draftId}
      draft={draft}
      items={items}
      step={step}
      status={status}
      errorMsg={errorMsg}
      queuedDone={queuedDone}
      onReload={() => void reload(draftId)}
      onStep={async (next) => {
        const store = await ensureOfflineDraftStore();
        await setDraftStep(store, actor, draftId, next);
        setStep(next);
      }}
      onQueuedDone={() => setQueuedDone(true)}
      onOpenCollection={() => router.push(`/coletas/${draftId}` as Route)}
    />
  );
}

type StepsProps = Readonly<{
  actor: CaptureActor;
  draftId: string;
  draft: OfflineDraftRecord | null;
  items: readonly OfflineItemRecord[];
  step: CaptureStep;
  status: SyncUxState;
  errorMsg: string | null;
  queuedDone: boolean;
  onReload: () => void;
  onStep: (step: CaptureStep) => Promise<void>;
  onQueuedDone: () => void;
  onOpenCollection: () => void;
}>;

function CaptureSteps({
  actor,
  draftId,
  draft,
  items,
  step,
  status,
  errorMsg,
  queuedDone,
  onReload,
  onStep,
  onQueuedDone,
  onOpenCollection,
}: StepsProps) {
  const [editingItem, setEditingItem] = useState<DraftItemDTO | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [signerNameDraft, setSignerNameDraft] = useState<string | null>(null);
  const [signerTaxIdDraft, setSignerTaxIdDraft] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(errorMsg);
  const signerName = signerNameDraft ?? draft?.responsibleName ?? "";
  const signerTaxId = signerTaxIdDraft ?? draft?.responsibleTaxId ?? "";

  async function persistItem(updatedData: {
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }) {
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
      void drainAllPending({
        store,
        commands: productionOfflineCommands,
        actor,
        lock: browserDrainLock(),
      }).then(onReload);
    }
  }

  if (queuedDone) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Coleta salva" subtitle="Sincronização" backHref={"/coletas" as Route} />
        <MobileStatePanel
          type="success"
          title="Salvo neste aparelho"
          subtitle={offlineCopy.queuedFinalize}
          actionText="Ver coletas"
          onAction={onOpenCollection}
        />
        <MobileBottomNav />
      </main>
    );
  }

  if (step === "itens") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Itens da coleta" subtitle={`Etapa 2 de 3 · ${items.length} itens`} backHref={"/coletas/nova" as Route} />
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
            <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
            <div className="h-1 w-12 rounded-full bg-[var(--color-border)]" />
          </div>
          <SyncStatusChip state={status} />
        </div>
        <div className="flex flex-col gap-6 px-6 pt-6">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">Registre tudo o que foi entregue.</h2>
          {localError ? <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">{localError}</div> : null}
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

  if (step === "revisao" && draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Revisar coleta" subtitle="Etapa 3 de 3" backHref={"/coletas/nova" as Route} />
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
            <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
            <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          </div>
          <SyncStatusChip state={status} />
        </div>
        <div className="flex flex-col gap-6 px-6 pt-6">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">Confira antes de emitir.</h2>
          <div className="flex flex-col gap-1 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">CLIENTE</span>
            <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">{draft.customer.displayName}</h3>
            <p className="text-[12px] font-normal text-[var(--color-text-muted)]">CNPJ / CPF · {draft.customer.taxId}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">ITENS · {items.length}</span>
            {items.map((item) => (
              <p key={item.id} className="text-[14px] font-normal text-[var(--color-text-primary)]">
                {item.description}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">LOCAL DA COLETA</span>
            <p className="text-[13px] font-normal text-[var(--color-text-primary)]">{draft.collectionLocation || "Local da coleta não informado"}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void onStep("itens")} className="h-[52px] rounded-[12px] text-[14px] font-semibold">
            Voltar aos itens
          </Button>
          <Button type="button" variant="primary" disabled={items.length === 0} onClick={() => void onStep("assinatura")} className="h-[52px] rounded-[12px] text-[14px] font-semibold">
            Emitir guia e coletar assinatura
          </Button>
        </div>
        <MobileBottomNav />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Assinatura do cliente" subtitle="Emissão da guia" backHref={"/coletas/nova" as Route} />
      <div className="flex flex-col gap-5 px-6 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">Confirme a entrega dos itens descritos.</h2>
          <SyncStatusChip state={status} />
        </div>
        {localError ? <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">{localError}</div> : null}
        <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Assine no espaço abaixo</h3>
          <SignaturePad disabled={isFinalizing} onClear={() => setSignatureDataUrl(null)} onSave={(url) => setSignatureDataUrl(url)} />
        </div>
        <Input label="Nome de quem assinou *" value={signerName} onChange={(event) => setSignerNameDraft(event.target.value)} required />
        <Input label="CPF/CNPJ de quem assinou *" value={signerTaxId} onChange={(event) => setSignerTaxIdDraft(event.target.value)} required />
        <Button
          type="button"
          variant="primary"
          isLoading={isFinalizing}
          className="mt-3 h-[52px] rounded-[12px] text-[14px] font-semibold"
          onClick={() => {
            void (async () => {
              if (!signerName.trim() || !signatureDataUrl) {
                setLocalError("Preencha o nome e a assinatura.");
                return;
              }
              const taxId = normalizeTaxId(signerTaxId);
              if (!/^\d{11}$|^\d{14}$/.test(taxId)) {
                setLocalError("Informe um CPF ou CNPJ válido.");
                return;
              }
              setIsFinalizing(true);
              try {
                const store = await ensureOfflineDraftStore();
                await saveLocalSignature({
                  store,
                  actor,
                  collectionId: draftId,
                  signerName: signerName.trim(),
                  signerTaxId: taxId,
                  acceptanceText: DEFAULT_ACCEPTANCE_TEXT,
                  dataUrl: signatureDataUrl,
                });
                if (isBrowserOnline()) {
                  await drainAllPending({
                    store,
                    commands: productionOfflineCommands,
                    actor,
                    lock: browserDrainLock(),
                  });
                  const leftover = await store.getDraft(draftId, actor.userId);
                  if (leftover === null) {
                    onOpenCollection();
                    return;
                  }
                }
                onQueuedDone();
              } catch (error: unknown) {
                setLocalError(isOfflineQuotaExceeded(error) ? offlineCopy.quotaExceeded : "Não foi possível guardar a assinatura.");
              } finally {
                setIsFinalizing(false);
              }
            })();
          }}
        >
          Finalizar coleta
        </Button>
      </div>
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
