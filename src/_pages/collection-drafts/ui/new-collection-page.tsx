"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { createDraftWithCustomerAction, searchCustomersAction } from "../api/actions";
import type { CustomerDTO } from "@/_pages/customers/model/customer";

export function NewCollectionPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "new">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<readonly CustomerDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  // Formulário de Novo Cliente
  const [displayName, setDisplayName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");

  // Formulário de Endereço de Coleta
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("SP");
  const [postalCode, setPostalCode] = useState("");
  const [collectionLocation, setCollectionLocation] = useState("");

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
    if (cust.address) {
      setStreet(cust.address.street);
      setStreetNumber(cust.address.streetNumber ?? "");
      setCity(cust.address.city);
      setStateCode(cust.address.stateCode);
      setPostalCode(cust.address.postalCode ?? "");
      setCollectionLocation(
        `${cust.address.street}, ${cust.address.streetNumber ?? "s/n"} - ${cust.address.city}/${cust.address.stateCode}`,
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    let locationStr = collectionLocation.trim();
    if (!locationStr && street.trim() && city.trim()) {
      locationStr = `${street.trim()}, ${streetNumber.trim() || "s/n"} - ${city.trim()}/${stateCode.trim().toUpperCase()}`;
    }

    if (tab === "search" && !selectedCustomer) {
      setErrorMsg("Selecione um cliente existente ou mude para a aba 'Novo Cliente'.");
      setIsLoading(false);
      return;
    }

    if (tab === "new" && (!displayName.trim() || !taxId.trim() || !phone.trim())) {
      setErrorMsg("Preencha Nome/Razão Social, CPF/CNPJ e Telefone do cliente.");
      setIsLoading(false);
      return;
    }

    const payload: {
      existingCustomerId?: string | null;
      newCustomer?: {
        displayName: string;
        taxId: string;
        phone: string;
        address?: {
          street: string;
          streetNumber?: string | null;
          complement?: string | null;
          district?: string | null;
          city: string;
          stateCode: string;
          postalCode?: string | null;
        };
      };
      collectionLocation?: string | null;
    } = {
      existingCustomerId: tab === "search" ? (selectedCustomer ? selectedCustomer.id : null) : null,
      collectionLocation: locationStr || null,
    };

    if (tab === "new") {
      payload.newCustomer = {
        displayName: displayName.trim(),
        taxId: taxId.trim(),
        phone: phone.trim(),
        ...(street.trim()
          ? {
              address: {
                street: street.trim(),
                streetNumber: streetNumber.trim() || null,
                city: city.trim() || "São Paulo",
                stateCode: stateCode.trim().toUpperCase() || "SP",
                postalCode: postalCode.trim() || null,
              },
            }
          : {}),
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Nova coleta"
        subtitle="Passo 1 de 4"
        backHref={"/coletas" as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Dados do cliente e da coleta
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Identifique quem está entregando o equipamento para a coleta MJT.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Seleção de Modos: Buscar vs Novo */}
        <div className="grid grid-cols-2 rounded-[12px] bg-[var(--color-surface-neutral)] p-1">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`min-h-[44px] rounded-[10px] text-[12px] font-semibold transition-colors ${
              tab === "search"
                ? "bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            Buscar Existente
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`min-h-[44px] rounded-[10px] text-[12px] font-semibold transition-colors ${
              tab === "new"
                ? "bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-xs"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            + Novo Cliente
          </button>
        </div>

        {/* Aba 1: Buscar Cliente Existente */}
        {tab === "search" && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Localizar por Nome ou CPF/CNPJ
              </h3>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input
                label="Digite para pesquisar"
                placeholder="Ex: João da Silva ou 123.456.789-00"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />

              {isSearching && (
                <p className="py-2 text-center text-[12px] text-[var(--color-muted)]">
                  Buscando clientes...
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">
                    Resultados ({searchResults.length}):
                  </span>
                  {searchResults.map((cust) => {
                    const isSelected = selectedCustomer?.id === cust.id;
                    return (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className={`flex min-h-[44px] items-center justify-between rounded-[12px] border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-[var(--color-surface-green)]"
                            : "border-[var(--color-border)] hover:bg-[var(--color-surface-neutral)]"
                        }`}
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--color-text)]">
                            {cust.displayName}
                          </p>
                          <p className="text-[11px] text-[var(--color-muted)]">
                            CPF/CNPJ: {cust.taxId} | Tel: {cust.phone}
                          </p>
                        </div>
                        {isSelected && <Badge status="collected">Selecionado</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedCustomer && (
                <div className="mt-2 rounded-[12px] border border-[var(--color-primary)] bg-[var(--color-surface-green)] p-3">
                  <span className="text-[10px] font-semibold uppercase text-[var(--color-primary-strong)]">
                    Cliente Selecionado:
                  </span>
                  <p className="text-[13px] font-semibold text-[var(--color-text)]">
                    {selectedCustomer.displayName}
                  </p>
                  <p className="text-[12px] text-[var(--color-muted)]">
                    CPF/CNPJ: {selectedCustomer.taxId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Aba 2: Novo Cliente */}
        {tab === "new" && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Cadastrar Novo Cliente
              </h3>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input
                label="Nome ou razão social *"
                placeholder="Ex: Auto Oficina Silva Ltda"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              <Input
                label="CPF/CNPJ *"
                placeholder="Ex: 00000000000 ou 00000000000000"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                required
              />
              <Input
                label="Telefone *"
                placeholder="Ex: 11999998888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </CardContent>
          </Card>
        )}

        {/* Seção de Endereço da Coleta */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Endereço cadastral / Retirada
            </h3>
            <p className="text-[12px] text-[var(--color-muted)]">
              Onde o equipamento está sendo coletado hoje.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="Rua / Logradouro"
              placeholder="Ex: Av. Paulista"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Número"
                placeholder="Ex: 1000"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
              />
              <Input
                label="CEP"
                placeholder="Ex: 01310100"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Cidade"
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <Input
                label="UF"
                placeholder="SP"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>
            <Input
              label="Observações do local"
              placeholder="Ex: Portão lateral da oficina, falar com o Marcos"
              value={collectionLocation}
              onChange={(e) => setCollectionLocation(e.target.value)}
            />
          </CardContent>
          <CardFooter className="pt-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              size="md"
            >
              Continuar →
            </Button>
          </CardFooter>
        </Card>
      </form>

      <MobileBottomNav />
    </main>
  );
}
