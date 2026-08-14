"use client";

import { useActionState } from "react";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { initialCompanySettingsActionState } from "@/shared/lib/action-result";
import { updateCompanySettingsAction, uploadCompanyLogoAction } from "../api/actions";

type Props = Readonly<{ settings: CompanySettingsDTO }>;

const valueOrEmpty = (value: string | null): string => value ?? "";

export function CompanySettingsForm({ settings }: Props) {
  const [state, formAction, pending] = useActionState(updateCompanySettingsAction, initialCompanySettingsActionState);
  const [logoState, logoAction, logoPending] = useActionState(uploadCompanyLogoAction, initialCompanySettingsActionState);

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="legalName" label="Razão social" defaultValue={valueOrEmpty(settings.legalName)} error={state.fieldErrors?.["legalName"]} maxLength={160} autoComplete="organization" />
          <Field name="taxId" label="CNPJ" defaultValue={valueOrEmpty(settings.taxId)} error={state.fieldErrors?.["taxId"]} inputMode="numeric" maxLength={18} />
          <Field name="phone" label="Telefone" defaultValue={valueOrEmpty(settings.phone)} error={state.fieldErrors?.["phone"]} maxLength={30} autoComplete="tel" />
          <Field name="street" label="Logradouro" defaultValue={valueOrEmpty(settings.address.street)} error={state.fieldErrors?.["street"]} maxLength={160} autoComplete="street-address" />
          <Field name="streetNumber" label="Número" defaultValue={valueOrEmpty(settings.address.streetNumber)} error={state.fieldErrors?.["streetNumber"]} maxLength={20} />
          <Field name="complement" label="Complemento" defaultValue={valueOrEmpty(settings.address.complement)} error={state.fieldErrors?.["complement"]} maxLength={120} />
          <Field name="district" label="Bairro" defaultValue={valueOrEmpty(settings.address.district)} error={state.fieldErrors?.["district"]} maxLength={100} />
          <Field name="city" label="Cidade" defaultValue={valueOrEmpty(settings.address.city)} error={state.fieldErrors?.["city"]} maxLength={100} autoComplete="address-level2" />
          <Field name="stateCode" label="UF" defaultValue={valueOrEmpty(settings.address.stateCode)} error={state.fieldErrors?.["stateCode"]} maxLength={2} />
          <Field name="postalCode" label="CEP" defaultValue={valueOrEmpty(settings.address.postalCode)} error={state.fieldErrors?.["postalCode"]} inputMode="numeric" maxLength={9} autoComplete="postal-code" />
          <Field name="signerName" label="Nome do signatário" defaultValue={valueOrEmpty(settings.signerName)} error={state.fieldErrors?.["signerName"]} maxLength={160} />
          <Field name="signerTitle" label="Cargo do signatário" defaultValue={valueOrEmpty(settings.signerTitle)} error={state.fieldErrors?.["signerTitle"]} maxLength={120} />
        </div>

        <div>
          <label htmlFor="receiptLegalText" className="mb-1 block text-sm font-medium">Texto jurídico do recibo</label>
          <textarea id="receiptLegalText" name="receiptLegalText" defaultValue={valueOrEmpty(settings.receiptLegalText)} rows={5} maxLength={2000} className="w-full rounded-md border border-border bg-surface px-3 py-2" />
          {state.fieldErrors?.["receiptLegalText"] ? <p className="mt-1 text-sm text-danger">{state.fieldErrors["receiptLegalText"]}</p> : null}
        </div>

        {state.message ? <p role="status" className={state.status === "success" ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p> : null}
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-5 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar configurações"}</button>
      </form>

      <form action={logoAction} className="border-t border-border pt-6">
        <label htmlFor="logo" className="mb-1 block text-sm font-medium">Logo institucional</label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" />
        <p className="mt-1 text-xs text-muted">PNG, JPEG ou WebP, até 2 MB. O bucket é privado.</p>
        {logoState.message ? <p role="status" className={logoState.status === "success" ? "mt-2 text-sm text-success" : "mt-2 text-sm text-danger"}>{logoState.message}</p> : null}
        <button type="submit" disabled={logoPending} className="mt-3 rounded-md border border-border bg-surface px-4 py-2 font-semibold disabled:opacity-60">{logoPending ? "Enviando…" : "Enviar logo"}</button>
      </form>
    </div>
  );
}

type FieldProps = Readonly<{ name: string; label: string; defaultValue: string; error: string | undefined; inputMode?: "numeric"; maxLength?: number; autoComplete?: string }>;

function Field({ name, label, defaultValue, error, inputMode, maxLength, autoComplete }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} defaultValue={defaultValue} inputMode={inputMode} maxLength={maxLength} autoComplete={autoComplete} className="w-full rounded-md border border-border bg-surface px-3 py-2" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
      {error ? <p id={errorId} className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
