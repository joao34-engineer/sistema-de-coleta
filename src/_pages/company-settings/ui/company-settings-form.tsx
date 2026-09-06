"use client";

import { useActionState, useEffect, useReducer, type Dispatch } from "react";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import type { CompanySettingsActionState } from "@/shared/lib/action-result";
import { initialCompanySettingsActionState } from "@/shared/lib/action-result";
import { updateCompanySettingsAction, uploadCompanyLogoAction } from "../api/actions";
import {
  applyPersistedSettings,
  applyServerSettings,
  createFormState,
  updateFormField,
  type CompanySettingsFormField,
  type CompanySettingsFormState,
} from "../model/company-settings-form-state";
import {
  getMissingIssuerFieldLabels,
  issuerFieldValuesFromDto,
  issuerRequiredFields,
} from "../model/issuer-settings";

type Props = Readonly<{ settings: CompanySettingsDTO }>;

type FormAction =
  | Readonly<{ type: "sync_server"; settings: CompanySettingsDTO }>
  | Readonly<{ type: "apply_persisted"; settings: CompanySettingsDTO }>
  | Readonly<{ type: "update_field"; field: CompanySettingsFormField; value: string }>;

function isRequired(field: CompanySettingsFormField): boolean {
  return issuerRequiredFields.some(({ key }) => key !== "logo" && key === field);
}

function formReducer(state: CompanySettingsFormState, action: FormAction): CompanySettingsFormState {
  switch (action.type) {
    case "sync_server":
      return applyServerSettings(state, action.settings);
    case "apply_persisted":
      return applyPersistedSettings(state, action.settings);
    case "update_field":
      return updateFormField(state, action.field, action.value);
    default:
      return state;
  }
}

function usePersistedSettingsEffect(
  actionState: CompanySettingsActionState,
  dispatch: Dispatch<FormAction>,
): void {
  useEffect(() => {
    if (actionState.persistedSettings === undefined) {
      return;
    }
    dispatch({ type: "apply_persisted", settings: actionState.persistedSettings });
  }, [actionState.persistedSettings, dispatch]);
}

function IssuerSetupBanner({ settings }: Readonly<{ settings: CompanySettingsDTO }>) {
  if (settings.setupStatus === "complete") {
    return (
      <div
        role="status"
        className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
      >
        Emissão habilitada
      </div>
    );
  }

  const missing = getMissingIssuerFieldLabels(issuerFieldValuesFromDto(settings));
  return (
    <div
      role="status"
      className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted"
    >
      <p className="font-medium">Emissão da guia ainda não habilitada.</p>
      {missing.length > 0 ? (
        <>
          <p className="mt-1">Complete os campos obrigatórios abaixo:</p>
          <ul className="mt-2 list-inside list-disc">
            {missing.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1">Salve novamente para confirmar o perfil de emissão.</p>
      )}
    </div>
  );
}

export function CompanySettingsForm({ settings }: Props) {
  const [formState, dispatch] = useReducer(formReducer, settings, createFormState);
  const [state, formAction, pending] = useActionState(updateCompanySettingsAction, initialCompanySettingsActionState);
  const [logoState, logoAction, logoPending] = useActionState(uploadCompanyLogoAction, initialCompanySettingsActionState);
  const anyPending = pending || logoPending;

  useEffect(() => {
    dispatch({ type: "sync_server", settings });
  }, [settings]);

  usePersistedSettingsEffect(state, dispatch);
  usePersistedSettingsEffect(logoState, dispatch);

  return (
    <div className="space-y-8">
      <IssuerSetupBanner settings={settings} />

      <form action={formAction} className="space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="legalName" label="Razão social" required={isRequired("legalName")} value={formState.values.legalName} onChange={(value) => dispatch({ type: "update_field", field: "legalName", value })} error={state.fieldErrors?.["legalName"]} maxLength={160} autoComplete="organization" />
          <Field name="taxId" label="CNPJ" required={isRequired("taxId")} value={formState.values.taxId} onChange={(value) => dispatch({ type: "update_field", field: "taxId", value })} error={state.fieldErrors?.["taxId"]} inputMode="numeric" maxLength={18} />
          <Field name="phone" label="Telefone" required={isRequired("phone")} value={formState.values.phone} onChange={(value) => dispatch({ type: "update_field", field: "phone", value })} error={state.fieldErrors?.["phone"]} maxLength={30} autoComplete="tel" />
          <Field name="street" label="Logradouro" required={isRequired("street")} value={formState.values.street} onChange={(value) => dispatch({ type: "update_field", field: "street", value })} error={state.fieldErrors?.["street"]} maxLength={160} autoComplete="street-address" />
          <Field name="streetNumber" label="Número" required={isRequired("streetNumber")} value={formState.values.streetNumber} onChange={(value) => dispatch({ type: "update_field", field: "streetNumber", value })} error={state.fieldErrors?.["streetNumber"]} maxLength={20} />
          <Field name="complement" label="Complemento" value={formState.values.complement} onChange={(value) => dispatch({ type: "update_field", field: "complement", value })} error={state.fieldErrors?.["complement"]} maxLength={120} />
          <Field name="district" label="Bairro" required={isRequired("district")} value={formState.values.district} onChange={(value) => dispatch({ type: "update_field", field: "district", value })} error={state.fieldErrors?.["district"]} maxLength={100} />
          <Field name="city" label="Cidade" required={isRequired("city")} value={formState.values.city} onChange={(value) => dispatch({ type: "update_field", field: "city", value })} error={state.fieldErrors?.["city"]} maxLength={100} autoComplete="address-level2" />
          <Field name="stateCode" label="UF" required={isRequired("stateCode")} value={formState.values.stateCode} onChange={(value) => dispatch({ type: "update_field", field: "stateCode", value })} error={state.fieldErrors?.["stateCode"]} maxLength={2} />
          <Field name="postalCode" label="CEP" required={isRequired("postalCode")} value={formState.values.postalCode} onChange={(value) => dispatch({ type: "update_field", field: "postalCode", value })} error={state.fieldErrors?.["postalCode"]} inputMode="numeric" maxLength={9} autoComplete="postal-code" />
          <Field name="signerName" label="Nome do signatário" required={isRequired("signerName")} value={formState.values.signerName} onChange={(value) => dispatch({ type: "update_field", field: "signerName", value })} error={state.fieldErrors?.["signerName"]} maxLength={160} />
          <Field name="signerTitle" label="Cargo do signatário" required={isRequired("signerTitle")} value={formState.values.signerTitle} onChange={(value) => dispatch({ type: "update_field", field: "signerTitle", value })} error={state.fieldErrors?.["signerTitle"]} maxLength={120} />
        </div>

        <div>
          <label htmlFor="receiptLegalText" className="mb-1 block text-sm font-medium">
            Texto jurídico do recibo <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="receiptLegalText"
            name="receiptLegalText"
            value={formState.values.receiptLegalText}
            onChange={(event) => dispatch({ type: "update_field", field: "receiptLegalText", value: event.target.value })}
            rows={5}
            maxLength={2000}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
          {state.fieldErrors?.["receiptLegalText"] ? <p className="mt-1 text-sm text-danger">{state.fieldErrors["receiptLegalText"]}</p> : null}
        </div>

        {state.message ? <p role="status" className={state.status === "success" ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p> : null}
        <button type="submit" disabled={anyPending} className="rounded-md bg-primary px-5 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar configurações"}</button>
      </form>

      <form action={logoAction} className="border-t border-border pt-6">
        <label htmlFor="logo" className="mb-1 block text-sm font-medium">
          Logo institucional <span aria-hidden="true">*</span>
        </label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" />
        <p className="mt-1 text-xs text-muted">PNG, JPEG ou WebP, até 2 MB. O bucket é privado.</p>
        {logoState.message ? <p role="status" className={logoState.status === "success" ? "mt-2 text-sm text-success" : "mt-2 text-sm text-danger"}>{logoState.message}</p> : null}
        <button type="submit" disabled={anyPending} className="mt-3 rounded-md border border-border bg-surface px-4 py-2 font-semibold disabled:opacity-60">{logoPending ? "Enviando…" : "Enviar logo"}</button>
      </form>
    </div>
  );
}

type FieldProps = Readonly<{
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  required?: boolean;
  inputMode?: "numeric";
  maxLength?: number;
  autoComplete?: string;
}>;

function Field({ name, label, value, onChange, error, required = false, inputMode, maxLength, autoComplete }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-md border border-border bg-surface px-3 py-2"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? <p id={errorId} className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
