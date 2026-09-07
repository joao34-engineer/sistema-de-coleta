import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { DashboardPage } from "@/_pages/dashboard/ui/dashboard-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("next/image", () => ({
  default: (props: Readonly<{ alt: string }>) => <span>{props.alt}</span>,
}));

vi.mock("@/shared/auth/actions", () => ({
  signOutAction: vi.fn(async () => ({ status: "idle" as const })),
  initialSignOutState: { status: "idle" as const },
}));

const administrator: AuthenticatedAdministrator = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "joaomarceloferreiratrader@gmail.com",
  organizationId: 1,
  organizationName: "MJT",
  fullName: null,
  role: "administrator",
};

const settings: CompanySettingsDTO = {
  organizationId: 1,
  displayName: "MJT",
  legalName: "MJT Walk Emissor Ltda",
  taxId: "11444777000161",
  phone: "1133334444",
  address: {
    street: "Rua",
    streetNumber: "1",
    complement: null,
    district: "Centro",
    city: "São Paulo",
    stateCode: "SP",
    postalCode: "01001000",
  },
  receiptLegalText: "texto",
  signerName: "Agente",
  signerTitle: "Responsavel",
  logoPath: "logo.png",
  setupStatus: "complete",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

describe("DashboardPage", () => {
  afterEach(() => cleanup());

  it("greets with the operator fallback instead of stuffing the account email into the header", () => {
    render(
      <DashboardPage
        administrator={administrator}
        settings={settings}
        activities={[]}
        inProgressCount={0}
        readyForDeliveryCount={0}
        todayLabel="segunda-feira, 7 de setembro de 2026"
      />,
    );
    expect(screen.getByRole("heading", { name: "Olá, Coletor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /gmail\.com/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("greets with the given name from the profile", () => {
    render(
      <DashboardPage
        administrator={{ ...administrator, fullName: "João Marcelo Walk" }}
        settings={settings}
        activities={[]}
        inProgressCount={0}
        readyForDeliveryCount={0}
        todayLabel="segunda-feira, 7 de setembro de 2026"
      />,
    );
    expect(screen.getByRole("heading", { name: "Olá, João" })).toBeInTheDocument();
  });
});
