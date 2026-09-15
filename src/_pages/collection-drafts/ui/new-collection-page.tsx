"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { searchCustomersAction, type CustomerView } from "@/app/actions/draft-flow.actions";
import { isOfflineQuotaExceeded } from "@/shared/lib/offline";
import type { CaptureActor } from "../model/capture-actor";
import { hasRequiredCollectionLocation } from "../model/has-required-collection-location";
import { cadastralAddressForSync, isIncompleteCadastral } from "../model/cadastral-address-for-sync";
import { createLocalDraft, normalizeTaxId } from "../model/offline-capture";
import { useOnlineStatus } from "@/shared/lib/pwa/use-online-status";
import { offlineCopy, titleForOperatorError } from "../model/offline-copy";
import { ensureOfflineDraftStore } from "../model/offline-port";
import { useCustomerSearch } from "../model/use-customer-search";
import { SyncStatusChip } from "./sync-status-chip";

type Props = Readonly<{
  actor: CaptureActor;
  onCreated: (draftId: string) => void;
}>;

const BRAZILIAN_STATE_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function NewCollectionPage({ actor, onCreated }: Props) {
  const [tab, setTab] = useState<"new" | "search">("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerView | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [collectionLocation, setCollectionLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const online = useOnlineStatus();
  const { results: searchResults, isSearching } = useCustomerSearch({
    query: searchQuery,
    online,
    search: searchCustomersAction,
  });

  const handleSelectCustomer = (cust: CustomerView) => {
    setSelectedCustomer(cust);
    setDisplayName(cust.displayName);
    setTaxId(cust.taxId);
    setPhone(cust.phone);
    if (cust.address) {
      setStreet(cust.address.street);
      setCity(cust.address.city ?? "");
      setStateCode(cust.address.stateCode ?? "");
    } else {
      setStreet("");
      setCity("");
      setStateCode("");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    if (tab === "search" && !online) {
      setErrorMsg(offlineCopy.searchOffline);
      return;
    }
    if (tab === "search" && !selectedCustomer) {
      setErrorMsg("Selecione um cliente existente ou preencha os dados do novo cliente.");
      return;
    }
    if (!displayName.trim() || !taxId.trim() || !phone.trim()) {
      setErrorMsg("Preencha Nome/Razão Social, CPF/CNPJ e Telefone.");
      return;
    }
    if (isIncompleteCadastral({ street, city, stateCode })) {
      setErrorMsg(offlineCopy.cadastralIncomplete);
      return;
    }
    if (!hasRequiredCollectionLocation(collectionLocation)) {
      setErrorMsg("Informe o local da coleta.");
      return;
    }
    const normalizedTaxId = normalizeTaxId(taxId);
    if (!/^\d{11}$|^\d{14}$/.test(normalizedTaxId)) {
      setErrorMsg("Informe um CPF ou CNPJ válido.");
      return;
    }

    setIsLoading(true);
    try {
      const store = await ensureOfflineDraftStore();
      const address = cadastralAddressForSync({ street, city, stateCode });
      const cadastralStreet = address?.street ?? null;
      const cadastralCity = address?.city;
      const cadastralState = address?.stateCode;
      const location = collectionLocation.trim();
      const customer =
        tab === "search" && selectedCustomer
          ? {
              mode: "existing" as const,
              customerId: selectedCustomer.id,
              displayName: selectedCustomer.displayName,
              taxId: normalizeTaxId(selectedCustomer.taxId),
              phone: selectedCustomer.phone,
              street: cadastralStreet,
              ...(cadastralCity === undefined ? {} : { city: cadastralCity }),
              ...(cadastralState === undefined ? {} : { stateCode: cadastralState }),
            }
          : {
              mode: "new" as const,
              displayName: displayName.trim(),
              taxId: normalizedTaxId,
              phone: phone.trim(),
              street: cadastralStreet,
              ...(cadastralCity === undefined ? {} : { city: cadastralCity }),
              ...(cadastralState === undefined ? {} : { stateCode: cadastralState }),
            };
      const draft = await createLocalDraft({ store, actor, customer, collectionLocation: location });
      onCreated(draft.id);
    } catch (error: unknown) {
      setErrorMsg(isOfflineQuotaExceeded(error) ? offlineCopy.quotaExceeded : "Não foi possível guardar o rascunho neste aparelho.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader title="Nova coleta" subtitle="Etapa 1 de 3 · Cliente" backHref={"/coletas" as Route} />

      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-8 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-border)]" />
          <div className="h-1 w-8 rounded-full bg-[var(--color-border)]" />
        </div>
        <SyncStatusChip state={online ? "online" : "saved_locally"} />
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6 px-6 pt-6">
        <h2 className="text-[24px] font-semibold leading-8 tracking-tight text-[var(--color-text-primary)]">
          Dados do cliente
        </h2>

        {errorMsg ? (
          <MobileStatePanel
            type="error"
            title={titleForOperatorError(errorMsg, "Não foi possível criar a coleta")}
            subtitle={errorMsg}
            actionText="Tentar novamente"
            onAction={() => setErrorMsg(null)}
          />
        ) : null}

        <div className="grid h-10 w-full max-w-[342px] grid-cols-2 rounded-[12px] bg-[var(--color-surface-neutral)] p-1">
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`h-8 rounded-[10px] text-[12px] font-semibold transition-all ${
              tab === "new" ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-xs" : "text-[var(--color-text-muted)]"
            }`}
          >
            Novo cliente
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`h-8 rounded-[10px] text-[12px] font-semibold transition-all ${
              tab === "search" ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-xs" : "text-[var(--color-text-muted)]"
            }`}
          >
            Buscar existente
          </button>
        </div>

        {tab === "search" ? (
          <div className="flex w-full max-w-[342px] flex-col gap-3">
            <Input
              placeholder="Digite o nome ou CPF/CNPJ..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              disabled={!online}
              aria-label="Digite o nome ou CPF/CNPJ..."
            />
            {!online ? (
              <p className="rounded-[12px] bg-[#fff8ec] px-3 py-2 text-[11px] font-semibold leading-4 text-[#a36b2c]">
                {offlineCopy.searchOffline}
              </p>
            ) : null}
            {isSearching ? <p className="py-2 text-center text-[12px] text-[var(--color-text-muted)]">Buscando...</p> : null}
            {searchResults.length > 0 ? (
              <div className="flex flex-col gap-2">
                {searchResults.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className={`flex min-h-[58px] flex-col items-start justify-center rounded-[12px] border px-3.5 py-3 text-left transition-colors ${
                      selectedCustomer?.id === cust.id
                        ? "border-[#4c916f] bg-[#e5f1e8]"
                        : "border-[var(--color-border)] bg-[var(--color-card-bg)]"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{cust.displayName}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {cust.taxId} · {cust.phone}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex w-full max-w-[342px] flex-col gap-4">
          <Input label="Nome ou razão social *" placeholder="Digite o nome" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          <Input label="CPF/CNPJ *" placeholder="Digite apenas números" value={taxId} onChange={(event) => setTaxId(event.target.value)} required />
          <Input label="Telefone *" placeholder="(00) 00000-0000" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          {tab === "new" ? (
            <>
              <Input label="Endereço cadastral" placeholder="Opcional" value={street} onChange={(event) => setStreet(event.target.value)} />
              <Input label="Cidade (se houver endereço)" placeholder="Opcional" value={city} onChange={(event) => setCity(event.target.value)} />
              <label className="flex w-full flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--color-muted)]">UF (se houver endereço)</span>
                <select
                  value={stateCode}
                  onChange={(event) => setStateCode(event.target.value)}
                  className="min-h-[48px] w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[14px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="">Não informar</option>
                  {BRAZILIAN_STATE_CODES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <Input
            label="Local da coleta *"
            placeholder="Onde os itens serão coletados"
            value={collectionLocation}
            onChange={(event) => setCollectionLocation(event.target.value)}
            required
          />
        </div>

        <Button type="submit" variant="primary" isLoading={isLoading} className="mt-4 h-[52px] rounded-[12px] text-[14px] font-semibold">
          Continuar
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
