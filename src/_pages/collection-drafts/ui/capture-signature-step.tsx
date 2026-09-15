"use client";

import { useState } from "react";
import type { Route } from "next";
import { isOfflineQuotaExceeded } from "@/shared/lib/offline";
import { invalidCpfOrCnpjMessage, isValidCpfOrCnpj } from "@/shared/lib/cpf";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { collectionExistsAction } from "../api/actions";
import { canFinalizeCollection } from "../model/can-finalize-collection";
import { captureStepHref } from "../model/capture-step-href";
import type { CaptureActor, SyncUxState } from "../model/capture-actor";
import { hasRequiredCollectionLocation } from "../model/has-required-collection-location";
import {
  DEFAULT_ACCEPTANCE_TEXT,
  isBrowserOnline,
  normalizeTaxId,
  saveLocalSignature,
} from "../model/offline-capture";
import { isSignerTaxIdQueueError, messageForQueueError, offlineCopy } from "../model/offline-copy";
import { ensureOfflineDraftStore } from "../model/offline-port";
import { presentFinalizeSync } from "../model/present-finalize-sync";
import { runAuthenticatedDrain, runAuthenticatedDrainCollection } from "../model/run-authenticated-drain";
import type { OfflineDraftRecord } from "../model/offline-records";
import { SyncStatusChip } from "./sync-status-chip";

const MISSING_COLLECTION_LOCATION_MSG = "Informe o local da coleta antes de continuar.";

type Props = Readonly<{
  actor: CaptureActor;
  draftId: string;
  draft: OfflineDraftRecord | null;
  itemCount: number;
  status: SyncUxState;
  errorMsg: string | null;
  onAwaitHydrate: () => Promise<void>;
  onQueuedDone: () => void;
  onOnlineFinalizeFailed: (error: string) => void;
  onOpenCollection: () => void;
}>;

export function CaptureSignatureStep({
  actor,
  draftId,
  draft,
  itemCount,
  status,
  errorMsg,
  onAwaitHydrate,
  onQueuedDone,
  onOnlineFinalizeFailed,
  onOpenCollection,
}: Props) {
  const [signerNameDraft, setSignerNameDraft] = useState<string | null>(null);
  const [signerTaxIdDraft, setSignerTaxIdDraft] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = errorMsg ?? localError;
  const signerName = signerNameDraft ?? draft?.responsibleName ?? "";
  const signerTaxId = signerTaxIdDraft ?? draft?.responsibleTaxId ?? "";

  const itemWord = itemCount === 1 ? "item" : "itens";

  if (isFinalizing) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Assinatura do signatário" subtitle="Emissão da guia" backHref={captureStepHref(draftId, "revisao") as Route} />
        <MobileStatePanel type="loading" title={offlineCopy.syncing} subtitle={offlineCopy.syncingBody} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Assinatura do signatário" subtitle="Emissão da guia" backHref={captureStepHref(draftId, "revisao") as Route} />
      <div className="flex flex-col gap-5 px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[24px] font-semibold leading-8 tracking-tight text-[var(--color-text-primary)]">Confirme a entrega dos itens descritos.</h2>
          <SyncStatusChip state={status} lastError={draft?.lastError ?? null} />
        </div>
        <p className="text-[13px] font-medium leading-5 text-[var(--color-primary-strong)]">
          Coleta · {itemCount} {itemWord}
        </p>
        {displayError ? <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">{displayError}</div> : null}
        <div className="flex w-full max-w-[342px] flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-xs">
          <h3 className="text-[14px] font-semibold leading-5 text-[var(--color-text-primary)]">Assine no espaço abaixo</h3>
          <SignaturePad disabled={isFinalizing} onClear={() => setSignatureDataUrl(null)} onSave={(url) => setSignatureDataUrl(url)} />
          <p className="text-center text-[12px] font-normal text-[var(--color-text-muted)]">Assinatura do signatário da guia</p>
        </div>
        <Input label="Nome de quem assinou *" value={signerName} onChange={(event) => setSignerNameDraft(event.target.value)} required />
        <Input
          label="CPF/CNPJ de quem assinou *"
          value={signerTaxId}
          onChange={(event) => {
            const next = event.target.value;
            setSignerTaxIdDraft(next);
            const digits = normalizeTaxId(next);
            if (/^\d{11}$|^\d{14}$/.test(digits) && !isValidCpfOrCnpj(digits)) {
              setLocalError(invalidCpfOrCnpjMessage(digits));
              return;
            }
            setLocalError(null);
          }}
          required
        />
        <Button
          type="button"
          variant="primary"
          isLoading={isFinalizing}
          disabled={
            !canFinalizeCollection({
              collectionLocation: draft?.collectionLocation,
              signatureDataUrl,
              signerName,
              signerTaxId,
            })
          }
          className="mt-3 h-[52px] rounded-[12px] text-[14px] font-semibold"
          onClick={() => {
            void (async () => {
              if (!hasRequiredCollectionLocation(draft?.collectionLocation)) {
                setLocalError(MISSING_COLLECTION_LOCATION_MSG);
                return;
              }
              if (!signerName.trim() || !signatureDataUrl) {
                setLocalError("Preencha o nome e a assinatura.");
                return;
              }
              const taxId = normalizeTaxId(signerTaxId);
              if (!isValidCpfOrCnpj(taxId)) {
                setLocalError(invalidCpfOrCnpjMessage(taxId));
                return;
              }
              setIsFinalizing(true);
              try {
                await onAwaitHydrate();
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
                const wasOnline = isBrowserOnline();
                if (wasOnline) {
                  await runAuthenticatedDrainCollection(actor, draftId);
                  void runAuthenticatedDrain(actor);
                }
                const leftover = await store.getDraft(draftId, actor.userId);
                const outcome = presentFinalizeSync({
                  wasOnline,
                  leftover,
                  serverRowExists: leftover === null ? await collectionExistsAction(draftId) : false,
                });
                if (outcome === "open_collection") {
                  onOpenCollection();
                  return;
                }
                if (outcome === "online_failed") {
                  if (isSignerTaxIdQueueError(leftover?.lastError)) {
                    setLocalError(messageForQueueError(leftover?.lastError));
                    return;
                  }
                  onOnlineFinalizeFailed(messageForQueueError(leftover?.lastError) || offlineCopy.onlineFinalizeFailed);
                  return;
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
    </main>
  );
}
