"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { hasRequiredCollectionLocation } from "../model/has-required-collection-location";
import { captureStepHref } from "../model/capture-step-href";
import type { SyncUxState } from "../model/capture-actor";
import { SyncStatusChip } from "./sync-status-chip";

const MISSING_COLLECTION_LOCATION_MSG = "Informe o local da coleta antes de continuar.";

function taxKindLabel(taxId: string): string {
  const digits = taxId.replace(/\D/g, "");
  return digits.length === 14 ? "CNPJ" : "CPF";
}

export type DraftReviewItem = Readonly<{
  id: string;
  description: string;
}>;

type Props = Readonly<{
  draftId: string;
  customerName: string;
  customerTaxId: string;
  items: readonly DraftReviewItem[];
  collectionLocation: string | null;
  syncState: SyncUxState;
  lastError: string | null;
  onPersistLocation: (location: string) => Promise<void>;
  onBackToItems: () => void;
  onContinue: () => void | Promise<void>;
}>;

export function DraftReviewPage({
  draftId,
  customerName,
  customerTaxId,
  items,
  collectionLocation,
  syncState,
  lastError,
  onPersistLocation,
  onBackToItems,
  onContinue,
}: Props) {
  const [locationDraft, setLocationDraft] = useState<string | null>(null);
  const locationValue = locationDraft ?? collectionLocation ?? "";
  const locationReady = hasRequiredCollectionLocation(locationValue);

  async function persistIfChanged(): Promise<void> {
    const trimmed = locationValue.trim();
    if (trimmed !== (collectionLocation?.trim() ?? "")) {
      await onPersistLocation(trimmed);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Revisar coleta" subtitle="Etapa 3 de 3" backHref={captureStepHref(draftId, "itens") as Route} />
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
        </div>
        <SyncStatusChip state={syncState} lastError={lastError} />
      </div>
      <div className="flex flex-col gap-6 px-6 pt-6">
        <h2 className="text-[24px] font-semibold leading-8 tracking-tight text-[var(--color-text-primary)]">Confira antes de emitir.</h2>
        <div className="flex w-full max-w-[342px] flex-col gap-1 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">CLIENTE</span>
          <h3 className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">{customerName}</h3>
          <p className="text-[12px] font-normal text-[var(--color-text-muted)]">{taxKindLabel(customerTaxId)} · {customerTaxId}</p>
        </div>
        <div className="flex w-full max-w-[342px] flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">ITENS · {items.length}</span>
          {items.map((item) => (
            <p key={item.id} className="text-[14px] font-normal leading-5 text-[var(--color-text-primary)]">
              {item.description}
            </p>
          ))}
        </div>
        <div
          className={`w-full max-w-[342px] rounded-[16px] border p-5 shadow-xs ${
            locationReady
              ? "border-[var(--color-border)] bg-[var(--color-card-bg)]"
              : "border-[#fca5a5] bg-[#fdf2f1]"
          }`}
        >
          <Input
            label="Local da coleta *"
            value={locationValue}
            onChange={(event) => {
              setLocationDraft(event.target.value);
            }}
            onBlur={() => {
              void persistIfChanged();
            }}
            required
            {...(locationReady ? {} : { error: MISSING_COLLECTION_LOCATION_MSG })}
          />
        </div>
        <Button type="button" variant="secondary" onClick={onBackToItems} className="h-[52px] rounded-[12px] text-[14px] font-semibold">
          Voltar aos itens
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={items.length === 0 || !locationReady}
          onClick={() => {
            if (!hasRequiredCollectionLocation(locationValue)) {
              return;
            }
            void (async () => {
              await persistIfChanged();
              await onContinue();
            })();
          }}
          className="h-[52px] rounded-[12px] text-[14px] font-semibold"
        >
          Emitir guia e coletar assinatura
        </Button>
      </div>
      <MobileBottomNav />
    </main>
  );
}
