import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { CollectorProfilePage } from "@/_pages/company-settings/ui/collector-profile-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/configuracoes",
}));

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

const administrator: AuthenticatedAdministrator = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "joaomarceloferreiratrader@gmail.com",
  organizationId: 1,
  organizationName: "MJT",
  fullName: "João Marcelo Walk",
  role: "administrator",
};

describe("CollectorProfilePage", () => {
  afterEach(() => cleanup());

  it("posts Sair to the sign-out route", () => {
    render(<CollectorProfilePage administrator={administrator} />);

    const form = screen.getByRole("button", { name: "Sair" }).closest("form");
    expect(form).toHaveAttribute("action", "/api/auth/sign-out");
    expect(form).toHaveAttribute("method", "post");
  });

  it("keeps the CFG01 hub heading distinct from the issuer leaf", () => {
    render(<CollectorProfilePage administrator={administrator} />);

    expect(screen.getByRole("heading", { name: "Conta" })).toBeInTheDocument();
    expect(screen.getByText("Configurações da conta")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operador autenticado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar perfil institucional" })).toBeInTheDocument();
    expect(screen.getByText("Dados jurídicos")).toBeInTheDocument();
    expect(screen.getByText("Razão social, CNPJ e rodapé dos recibos")).toBeInTheDocument();
    expect(screen.getByText("Perfil institucional")).toBeInTheDocument();
    expect(screen.getByText("Editar no fluxo /configuracoes/empresa")).toBeInTheDocument();
    expect(screen.getByText("Encerra a sessão deste aparelho")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Empresa" })).not.toBeInTheDocument();
  });
});
