import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { CompanySettingsPage } from "@/_pages/company-settings/ui/company-settings-page";

vi.mock("@/_pages/company-settings/api/actions", () => ({
  updateCompanySettingsAction: vi.fn(async () => ({ status: "success", code: "success", message: "ok" })),
  uploadCompanyLogoAction: vi.fn(async () => ({ status: "success", code: "success", message: "ok" })),
}));

const baseSettings: CompanySettingsDTO = {
  organizationId: 1,
  displayName: "MJT",
  legalName: null,
  taxId: null,
  phone: null,
  address: {
    street: null,
    streetNumber: null,
    complement: null,
    district: null,
    city: null,
    stateCode: null,
    postalCode: null,
  },
  receiptLegalText: null,
  signerName: null,
  signerTitle: null,
  logoPath: null,
  setupStatus: "pending",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

describe("CompanySettingsPage", () => {
  afterEach(() => cleanup());

  it("does not promise future use of institutional data", () => {
    render(<CompanySettingsPage settings={baseSettings} />);
    expect(screen.queryByText(/futuramente/i)).not.toBeInTheDocument();
    expect(screen.getByText(/guia de coleta \(PDF\)/i)).toBeInTheDocument();
  });

  it("shows the pending issuer banner for an incomplete profile", () => {
    render(<CompanySettingsPage settings={baseSettings} />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Emissão da guia ainda não habilitada.");
    expect(banner).toHaveTextContent("Razão social");
    expect(banner).toHaveTextContent("Logo institucional");
  });

  it("shows emission enabled when setup is complete", () => {
    render(
      <CompanySettingsPage
        settings={{
          ...baseSettings,
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
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Emissão habilitada");
  });
});
