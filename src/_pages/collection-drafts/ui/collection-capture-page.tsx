"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { isOfflineQuotaExceeded } from "@/shared/lib/offline";
import type { CaptureActor, CaptureStep, SyncUxState } from "../model/capture-actor";
import { captureStepHref } from "../model/capture-step-href";
import {
  hydrateServerDraft,
  isBrowserOnline,
  patchLocalDraft,
  setDraftStep,
} from "../model/offline-capture";
import { messageForQueueError, offlineCopy, titleForOperatorError } from "../model/offline-copy";
import { ensureOfflineDraftStore } from "../model/offline-port";
import { presentFinalizeSync } from "../model/present-finalize-sync";
import { runAuthenticatedDrain } from "../model/run-authenticated-drain";
import type { OfflineDraftRecord, OfflineItemRecord } from "../model/offline-records";
import { collectionExistsAction, fetchDraftWithItemsAction } from "../api/actions";
import { getCustomerAction } from "@/app/actions/draft-flow.actions";
import { toOfflineExistingCustomer, toOfflineDraftPreview, type WizardDraftProps } from "../model/wizard-draft-props";
import { CaptureStepFallback } from "./capture-step-fallback";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { useOnlineStatus } from "@/shared/lib/pwa/use-online-status";

const NewCollectionPage = dynamic(
  () => import("./new-collection-page").then((mod) => ({ default: mod.NewCollectionPage })),
  { loading: CaptureStepFallback },
);
const CaptureItemsStep = dynamic(
  () => import("./capture-items-step").then((mod) => ({ default: mod.CaptureItemsStep })),
  { loading: CaptureStepFallback },
);
const DraftReviewPage = dynamic(
  () => import("./draft-review-page").then((mod) => ({ default: mod.DraftReviewPage })),
  { loading: CaptureStepFallback },
);
const CaptureSignatureStep = dynamic(
  () => import("./capture-signature-step").then((mod) => ({ default: mod.CaptureSignatureStep })),
  { ssr: false, loading: CaptureStepFallback },
);

type HydrateStatus = "pending" | "ready" | "failed";

type Props = Readonly<{
  actor: CaptureActor;
  resumeDraftId?: string;
  initialStep?: CaptureStep;
  initialDraft?: WizardDraftProps;
}>;

function uxState(online: boolean, syncStatus: OfflineDraftRecord["syncStatus"]): SyncUxState {
  if (syncStatus === "failed") return "failed";
  if (syncStatus === "syncing") return "syncing";
  if (syncStatus === "synced" && online) return "synced";
  if (online && syncStatus === "queued") return "online";
  return "saved_locally";
}

function createHydrateGate(): { readonly promise: Promise<void>; resolve: () => void } {
  let resolveGate = () => {};
  const promise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  return { promise, resolve: resolveGate };
}

export function CollectionCapturePage({ actor, resumeDraftId, initialStep, initialDraft }: Props) {
  const router = useRouter();
  const preview = useMemo(() => {
    if (initialDraft === undefined) {
      return null;
    }
    return toOfflineDraftPreview({
      actor,
      draft: initialDraft.draft,
      items: initialDraft.items,
      hasSignature: initialDraft.hasSignature,
      step: initialStep ?? "itens",
      customer: initialDraft.customer,
    });
  }, [actor, initialDraft, initialStep]);
  const [step, setStep] = useState<CaptureStep>(initialStep ?? (resumeDraftId ? "itens" : "cliente"));
  const [draftId, setDraftId] = useState<string | null>(resumeDraftId ?? null);
  const [draft, setDraft] = useState<OfflineDraftRecord | null>(preview?.draft ?? null);
  const [items, setItems] = useState<readonly OfflineItemRecord[]>(preview?.items ?? []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hydrateStatus, setHydrateStatus] = useState<HydrateStatus>(
    resumeDraftId && preview === null ? "pending" : "ready",
  );
  const online = useOnlineStatus();
  const [queuedDone, setQueuedDone] = useState(false);
  const [onlineFinalizeError, setOnlineFinalizeError] = useState<string | null>(null);
  const stepChangeInFlight = useRef(false);
  const [hydrateGate] = useState(createHydrateGate);

  const abortHydrate = useCallback((message: string) => {
    setErrorMsg(message);
    setHydrateStatus("failed");
    return null;
  }, []);

  const applyLoaded = useCallback(
    (resolved: OfflineDraftRecord, nextItems: readonly OfflineItemRecord[]) => {
      const nextStep = initialStep ?? resolved.currentStep;
      setDraft({ ...resolved, currentStep: nextStep });
      setItems(nextItems);
      setStep(nextStep);
      setDraftId(resolved.id);
      setErrorMsg(null);
      setHydrateStatus("ready");
    },
    [initialStep],
  );

  const reload = useCallback(
    async (id: string) => {
      const store = await ensureOfflineDraftStore();
      if (initialDraft !== undefined && initialDraft.draft.id === id) {
        try {
          const hydrated = await hydrateServerDraft({
            store,
            actor,
            draft: initialDraft.draft,
            items: initialDraft.items,
            hasSignature: initialDraft.hasSignature,
            step: initialStep ?? "itens",
            customer: initialDraft.customer,
          });
          if (initialStep !== undefined && hydrated.currentStep !== initialStep) {
            await setDraftStep(store, actor, id, initialStep);
          }
          const resolved = (await store.getDraft(id, actor.userId)) ?? hydrated;
          applyLoaded(resolved, await store.listItems(id, actor.userId));
          return resolved;
        } catch {
          return abortHydrate(offlineCopy.hydrateCustomerFailed);
        }
      }
      const local = await store.getDraft(id, actor.userId);
      if (local) {
        if (initialStep !== undefined && initialStep !== local.currentStep) {
          await setDraftStep(store, actor, id, initialStep);
        }
        const resolved =
          (await store.getDraft(id, actor.userId)) ??
          (initialStep !== undefined ? { ...local, currentStep: initialStep } : local);
        applyLoaded(resolved, await store.listItems(id, actor.userId));
        return resolved;
      }
      if (!isBrowserOnline()) {
        return abortHydrate("Rascunho de coleta não encontrado.");
      }
      const remote = await fetchDraftWithItemsAction(id);
      if (!remote.ok) {
        return abortHydrate("Rascunho de coleta não encontrado.");
      }
      const customerId = remote.draft.customerId;
      if (customerId === null) {
        return abortHydrate(offlineCopy.hydrateCustomerFailed);
      }
      const fetched = await getCustomerAction(customerId);
      if (!fetched.ok) {
        return abortHydrate(offlineCopy.hydrateCustomerFailed);
      }
      const customer = toOfflineExistingCustomer({
        customerId,
        displayName: fetched.customer.displayName,
        taxId: fetched.customer.taxId,
        phone: fetched.customer.phone,
        street: fetched.customer.address?.street ?? null,
        city: fetched.customer.address?.city ?? null,
        stateCode: fetched.customer.address?.stateCode ?? null,
      });
      if (customer === null) {
        return abortHydrate(offlineCopy.hydrateCustomerFailed);
      }
      try {
        const hydrated = await hydrateServerDraft({
          store,
          actor,
          draft: remote.draft,
          items: remote.items,
          hasSignature: remote.hasSignature,
          step: initialStep ?? "itens",
          customer,
        });
        applyLoaded(hydrated, await store.listItems(id, actor.userId));
        return hydrated;
      } catch {
        return abortHydrate(offlineCopy.hydrateCustomerFailed);
      }
    },
    [abortHydrate, actor, applyLoaded, initialDraft, initialStep],
  );

  const drainIfOnline = useCallback(
    async (id?: string) => {
      if (!isBrowserOnline()) {
        return;
      }
      await runAuthenticatedDrain(actor);
      if (id) {
        await reload(id);
      }
    },
    [actor, reload],
  );

  useEffect(() => {
    if (!online) {
      return;
    }
    const timer = window.setTimeout(() => {
      void drainIfOnline(draftId ?? undefined);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [online, draftId, drainIfOnline]);

  useEffect(() => {
    void (async () => {
      try {
        const store = await ensureOfflineDraftStore();
        await store.refreshSnapshot(actor.userId);
        if (resumeDraftId) {
          await reload(resumeDraftId);
        }
        await drainIfOnline(resumeDraftId);
      } finally {
        hydrateGate.resolve();
      }
    })();
  }, [actor.userId, resumeDraftId, reload, drainIfOnline, hydrateGate]);

  const awaitHydrate = useCallback(() => hydrateGate.promise, [hydrateGate]);

  const status = useMemo(() => uxState(online, draft?.syncStatus ?? "local"), [online, draft]);

  if (resumeDraftId && hydrateStatus === "pending") {
    return <CaptureStepFallback />;
  }

  if (hydrateStatus === "failed") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Coleta" subtitle="Erro ao carregar" backHref={"/coletas" as Route} />
        <MobileStatePanel
          type="error"
          title={offlineCopy.hydrateCustomerFailed}
          subtitle={errorMsg ?? offlineCopy.hydrateCustomerFailed}
          actionText={offlineCopy.retry}
          onAction={() => {
            const id = resumeDraftId ?? draftId;
            if (id === null) {
              return;
            }
            setHydrateStatus("pending");
            void reload(id);
          }}
        />
      </main>
    );
  }

  if (step === "cliente" || draftId === null) {
    return (
      <NewCollectionPage
        actor={actor}
        onCreated={(id) => {
          setDraftId(id);
          setStep("itens");
          router.replace(captureStepHref(id, "itens") as Route);
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
      onlineFinalizeError={onlineFinalizeError}
      onAwaitHydrate={awaitHydrate}
      onReload={() => void reload(draftId)}
      onStep={async (next) => {
        if (stepChangeInFlight.current || next === step) {
          return;
        }
        const previous = step;
        stepChangeInFlight.current = true;
        setStep(next);
        router.replace(captureStepHref(draftId, next) as Route);
        try {
          await awaitHydrate();
          const store = await ensureOfflineDraftStore();
          await setDraftStep(store, actor, draftId, next);
        } catch (error: unknown) {
          setStep(previous);
          router.replace(captureStepHref(draftId, previous) as Route);
          setErrorMsg(isOfflineQuotaExceeded(error) ? offlineCopy.quotaExceeded : offlineCopy.stepPersistFailed);
        } finally {
          stepChangeInFlight.current = false;
        }
      }}
      onQueuedDone={() => setQueuedDone(true)}
      onOnlineFinalizeFailed={(error) => setOnlineFinalizeError(error)}
      onClearOnlineFinalizeError={() => setOnlineFinalizeError(null)}
      onOpenCollection={() => router.push(`/coletas/${draftId}` as Route)}
      onOpenCollectionList={() => router.push("/coletas" as Route)}
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
  onlineFinalizeError: string | null;
  onAwaitHydrate: () => Promise<void>;
  onReload: () => void;
  onStep: (step: CaptureStep) => Promise<void>;
  onQueuedDone: () => void;
  onOnlineFinalizeFailed: (error: string) => void;
  onClearOnlineFinalizeError: () => void;
  onOpenCollection: () => void;
  onOpenCollectionList: () => void;
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
  onlineFinalizeError,
  onAwaitHydrate,
  onReload,
  onStep,
  onQueuedDone,
  onOnlineFinalizeFailed,
  onClearOnlineFinalizeError,
  onOpenCollection,
  onOpenCollectionList,
}: StepsProps) {
  async function persistLocation(nextLocation: string) {
    await onAwaitHydrate();
    const store = await ensureOfflineDraftStore();
    await patchLocalDraft({
      store,
      actor,
      collectionId: draftId,
      collectionLocation: nextLocation,
    });
    onReload();
    if (isBrowserOnline()) {
      void runAuthenticatedDrain(actor).then(onReload);
    }
  }

  if (onlineFinalizeError !== null) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Sincronização" subtitle="Falha ao enviar" backHref={"/coletas" as Route} />
        <MobileStatePanel
          type="error"
          title={titleForOperatorError(onlineFinalizeError, offlineCopy.failed)}
          subtitle={onlineFinalizeError}
          actionText={offlineCopy.retry}
          onAction={() => {
            void (async () => {
              await onAwaitHydrate();
              const store = await ensureOfflineDraftStore();
              await runAuthenticatedDrain(actor);
              const leftover = await store.getDraft(draftId, actor.userId);
              const next = presentFinalizeSync({
                wasOnline: true,
                leftover,
                serverRowExists: leftover === null ? await collectionExistsAction(draftId) : false,
              });
              if (next === "open_collection") {
                onClearOnlineFinalizeError();
                onOpenCollection();
                return;
              }
              if (next === "queued_local") {
                onClearOnlineFinalizeError();
                onOpenCollectionList();
                return;
              }
              onOnlineFinalizeFailed(messageForQueueError(leftover?.lastError) || offlineCopy.onlineFinalizeFailed);
              onReload();
            })();
          }}
        />
      </main>
    );
  }

  if (queuedDone) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader title="Coleta salva" subtitle="Sincronização" backHref={"/coletas" as Route} />
        <MobileStatePanel
          type="success"
          title={offlineCopy.savedLocally}
          subtitle={offlineCopy.savedLocallyBody}
          actionText="Ver coletas"
          onAction={onOpenCollectionList}
        />
      </main>
    );
  }

  if (step === "itens") {
    return (
      <CaptureItemsStep
        actor={actor}
        draftId={draftId}
        draft={draft}
        items={items}
        status={status}
        displayError={errorMsg}
        onReload={onReload}
        onStep={onStep}
        onAwaitHydrate={onAwaitHydrate}
      />
    );
  }

  if (step === "revisao" && draft) {
    return (
      <DraftReviewPage
        draftId={draftId}
        customerName={draft.customer.displayName}
        customerTaxId={draft.customer.taxId}
        items={items}
        collectionLocation={draft.collectionLocation}
        syncState={status}
        lastError={draft.lastError}
        onPersistLocation={persistLocation}
        onContinue={() => onStep("assinatura")}
      />
    );
  }

  return (
    <CaptureSignatureStep
      actor={actor}
      draftId={draftId}
        draft={draft}
        itemCount={items.length}
        status={status}
      errorMsg={errorMsg}
      onAwaitHydrate={onAwaitHydrate}
      onQueuedDone={onQueuedDone}
      onOnlineFinalizeFailed={onOnlineFinalizeFailed}
      onOpenCollection={onOpenCollection}
    />
  );
}
