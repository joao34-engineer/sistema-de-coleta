import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";

const testState = vi.hoisted(() => ({
  rpcCalls: 0,
  rpcError: null as { message: string; code?: string } | null,
  activeProfile: true,
  logoAssetId: "66666666-6666-4666-8666-666666666666" as string | null,
  updateError: null as { code?: string } | null,
  uploadResult: { ok: true as const, assetId: "66666666-6666-4666-8666-666666666666", storagePath: "1/company-logo/logo.png", reused: false },
  authError: null as "401" | "403" | null,
}));

const persistedSettings: CompanySettingsDTO = {
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
  logoPath: "1/company-logo/logo.png",
  setupStatus: "complete",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

const completeInput = {
  legalName: "MJT Serviços Ltda.",
  taxId: "04252011000110",
  phone: "11999999999",
  street: "Rua MJT",
  streetNumber: "10",
  complement: null,
  district: "Centro",
  city: "São Paulo",
  stateCode: "SP",
  postalCode: "01001000",
  receiptLegalText: "Texto do recibo",
  signerName: "João Marcelo",
  signerTitle: "Administrador",
};

vi.mock("@/shared/auth/require-admin", async () => {
  const actual = await vi.importActual<typeof import("@/shared/auth/require-admin")>("@/shared/auth/require-admin");
  return {
    ...actual,
    requireAuthenticatedAdministrator: async () => {
      if (testState.authError === "401") throw new AuthenticationRequiredError();
      if (testState.authError === "403") throw new AdministratorAccessDeniedError();
      return {
        userId: "11111111-1111-4111-8111-111111111111",
        email: "admin@example.com",
        fullName: "Admin",
        organizationId: 1,
        organizationDisplayName: "MJT",
      };
    },
  };
});

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () =>
              testState.updateError
                ? { data: null, error: testState.updateError }
                : { data: { logo_asset_id: testState.logoAssetId }, error: null },
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "document_issuer_profiles"
              ? { data: testState.activeProfile ? { id: "profile-id" } : null, error: null }
              : {
                  data: {
                    legal_name: completeInput.legalName,
                    tax_id: completeInput.taxId,
                    phone: completeInput.phone,
                    street: completeInput.street,
                    street_number: completeInput.streetNumber,
                    address_complement: completeInput.complement,
                    district: completeInput.district,
                    city: completeInput.city,
                    state_code: completeInput.stateCode,
                    postal_code: completeInput.postalCode,
                    receipt_legal_text: completeInput.receiptLegalText,
                    signer_name: completeInput.signerName,
                    signer_title: completeInput.signerTitle,
                  },
                  error: null,
                },
          eq: () => ({
            limit: () => ({
              maybeSingle: async () =>
                table === "document_issuer_profiles"
                  ? { data: testState.activeProfile ? { id: "profile-id" } : null, error: null }
                  : { data: null, error: null },
            }),
          }),
        }),
      }),
    }),
    rpc: async () => {
      testState.rpcCalls += 1;
      return testState.rpcError ? { error: testState.rpcError } : { error: null };
    },
  }),
}));

vi.mock("@/shared/db/company-settings", () => ({
  getCompanySettingsForAdministrator: async () => persistedSettings,
}));

vi.mock("@/_pages/company-settings/api/brand-assets.server", () => ({
  createOrReuseLogoAsset: async () => testState.uploadResult,
}));

import { saveCompanySettings, uploadCompanyLogo } from "@/_pages/company-settings/api/commands";

describe("company settings commands", () => {
  beforeEach(() => {
    testState.rpcCalls = 0;
    testState.rpcError = null;
    testState.activeProfile = true;
    testState.logoAssetId = "66666666-6666-4666-8666-666666666666";
    testState.updateError = null;
    testState.authError = null;
    testState.uploadResult = {
      ok: true,
      assetId: "66666666-6666-4666-8666-666666666666",
      storagePath: "1/company-logo/logo.png",
      reused: false,
    };
  });

  it("returns incomplete without calling the publication RPC when settings are incomplete", async () => {
    const result = await saveCompanySettings({ ...completeInput, district: null }, "req-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publicationStatus).toBe("incomplete");
    expect(testState.rpcCalls).toBe(0);
  });

  it("calls the short RPC and reports published when an active profile exists", async () => {
    const result = await saveCompanySettings(completeInput, "req-2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publicationStatus).toBe("published");
    expect(testState.rpcCalls).toBe(1);
  });

  it("returns failed with persisted settings when publication fails", async () => {
    testState.rpcError = { message: "issuer_settings_incomplete", code: "P0001" };
    const result = await saveCompanySettings(completeInput, "req-3");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.settingsPersisted).toBe(true);
    expect(result.publicationStatus).toBe("failed");
    expect(result.settings).toEqual(persistedSettings);
  });

  it("does not claim persistence when the settings write fails", async () => {
    testState.updateError = { code: "22023" };
    const result = await saveCompanySettings(completeInput, "req-4");
    expect(result).toEqual({ ok: false, code: "settings_write_failed", settingsPersisted: false });
  });

  it("rejects unauthorized callers", async () => {
    testState.authError = "403";
    await expect(saveCompanySettings(completeInput, "req-5")).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("uploads logo through the authenticated flow and can publish", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const result = await uploadCompanyLogo({
      file,
      contentType: "image/png",
      extension: "png",
      sha256: "abc",
      requestId: "req-6",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.publicationStatus).toBe("published");
  });
});
