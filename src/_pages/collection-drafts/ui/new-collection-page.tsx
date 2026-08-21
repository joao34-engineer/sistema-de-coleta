"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { createDraftWithCustomerAction, searchCustomersAction } from "../api/actions";
import type { CustomerDTO } from "@/_pages/customers/model/customer";

export function NewCollectionPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"new" | "search">("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<readonly CustomerDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  // Form states matching Figma M02 (13:27)
  const [displayName, setDisplayName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const res = await searchCustomersAction(query.trim());
    setIsSearching(false);
    if (res.ok) {
      setSearchResults(res.customers);
    }
  };

  const handleSelectCustomer = (cust: CustomerDTO) => {
    setSelectedCustomer(cust);
    setDisplayName(cust.displayName);
    setTaxId(cust.taxId);
    setPhone(cust.phone);
    if (cust.address) {
      setStreet(cust.address.street);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    if (tab === "search" && !selectedCustomer) {
      setErrorMsg("Selecione um cliente existente ou preencha os dados do novo cliente.");
      setIsLoading(false);
      return;
    }

    if (!displayName.trim() || !taxId.trim() || !phone.trim()) {
      setErrorMsg("Preencha Nome/Razão Social, CPF/CNPJ e Telefone.");
      setIsLoading(false);
      return;
    }

    const payload: Parameters<typeof createDraftWithCustomerAction>[0] = {
      existingCustomerId: tab === "search" && selectedCustomer ? selectedCustomer.id : null,
      collectionLocation: street.trim() || null,
    };

    if (tab === "new") {
      payload.newCustomer = {
        displayName: displayName.trim(),
        taxId: taxId.trim(),
        phone: phone.trim(),
        ...(street.trim() ? { address: { street: street.trim(), city: "São Paulo", stateCode: "SP" } } : {})
      };
    }

    const res = await createDraftWithCustomerAction(payload);

    setIsLoading(false);

    if (!res.ok) {
      if (res.error === "duplicate_tax_id") {
        setErrorMsg("Já existe um cliente cadastrado com este CPF/CNPJ.");
      } else {
        setErrorMsg(`Erro ao criar coleta: ${res.error}`);
      }
      return;
    }

    router.push(`/coletas/${res.draftId}/itens` as Route);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Nova coleta"
        subtitle="Etapa 1 de 3 · Cliente"
        backHref={"/coletas" as Route}
      />

      {/* Progress Bar (M02 Node 13:27: 1 de 3 ativa) */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-border)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-border)]" />
        </div>
        <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
          1 de 3
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 pt-6">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Quem está entregando os itens?
          </h2>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Tab Toggle entre Cadastrar e Buscar */}
        <div className="grid grid-cols-2 rounded-[12px] bg-[var(--color-surface-neutral)] p-1">
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`min-h-[40px] rounded-[10px] text-[12px] font-semibold transition-all ${
              tab === "new"
                ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-xs"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            Novo cliente
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`min-h-[40px] rounded-[10px] text-[12px] font-semibold transition-all ${
              tab === "search"
                ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-xs"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            Buscar existente
          </button>
        </div>

        {tab === "search" && (
          <div className="flex flex-col gap-3">
            <Input
              label="Buscar cliente"
              placeholder="Digite o nome ou CPF/CNPJ..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {isSearching && (
              <p className="py-2 text-center text-[12px] text-[var(--color-text-muted)]">
                Buscando...
              </p>
            )}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {searchResults.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className={`flex items-center justify-between rounded-[12px] border p-3.5 text-left transition-colors ${
                      selectedCustomer?.id === cust.id
                        ? "border-[var(--color-primary)] bg-[var(--color-surface-green)]"
                        : "border-[var(--color-border)] bg-[var(--color-card-bg)]"
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                        {cust.displayName}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {cust.taxId} · {cust.phone}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campos Fies ao Figma (Node 13:27) */}
        <div className="flex flex-col gap-4">
          <Input
            label="Nome ou razão social *"
            placeholder="Digite o nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            label="CPF/CNPJ *"
            placeholder="Digite apenas números"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            required
          />

          <Input
            label="Telefone *"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <Input
            label="Endereço cadastral"
            placeholder="Opcional"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="mt-4 h-[52px] rounded-[12px] text-[14px] font-semibold"
        >
          Continuar
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}

