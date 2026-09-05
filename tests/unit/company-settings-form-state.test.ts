import { describe, expect, it } from "vitest";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import {
  applyPersistedSettings,
  applyServerSettings,
  createFormState,
  settingsToFormValues,
  updateFormField,
} from "@/_pages/company-settings/model/company-settings-form-state";

const settings: CompanySettingsDTO = {
  organizationId: 1,
  displayName: "MJT",
  legalName: "MJT Serviços Ltda.",
  taxId: "04252011000110",
  phone: "11999999999",
  address: {
    street: "Rua MJT",
    streetNumber: "10",
    complement: null,
    district: "Centro",
    city: "São Paulo",
    stateCode: "SP",
    postalCode: "01001000",
  },
  receiptLegalText: "Texto do recibo",
  signerName: "João Marcelo",
  signerTitle: "Administrador",
  logoPath: null,
  setupStatus: "pending",
  updatedAt: "2026-08-14T00:00:00.000Z",
};

describe("company settings form state", () => {
  it("initializes from server settings", () => {
    expect(createFormState(settings).values).toEqual(settingsToFormValues(settings));
  });

  it("keeps dirty values when stale server props arrive", () => {
    const state = updateFormField(createFormState(settings), "legalName", "Editado localmente");
    const stale = { ...settings, legalName: "Valor antigo", updatedAt: "2026-08-13T00:00:00.000Z" };
    expect(applyServerSettings(state, stale).values.legalName).toBe("Editado localmente");
  });

  it("adopts canonical persisted settings after save", () => {
    const dirty = updateFormField(createFormState(settings), "legalName", "Editado localmente");
    const persisted = { ...settings, legalName: "Valor persistido", updatedAt: "2026-08-15T00:00:00.000Z" };
    const next = applyPersistedSettings(dirty, persisted);
    expect(next.values.legalName).toBe("Valor persistido");
    expect(next.dirty).toBe(false);
  });

  it("does not overwrite dirty text with a logo upload snapshot", () => {
    const dirty = updateFormField(createFormState(settings), "phone", "11888888888");
    const logoSnapshot = { ...settings, phone: "11777777777", updatedAt: "2026-08-15T00:00:00.000Z" };
    expect(applyServerSettings(dirty, logoSnapshot).values.phone).toBe("11888888888");
  });
});
