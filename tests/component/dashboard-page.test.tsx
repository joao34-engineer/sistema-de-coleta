import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { DashboardPage } from "@/_pages/dashboard/ui/dashboard-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
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
  fullName: null,
  role: "administrator",
};

describe("DashboardPage", () => {
  afterEach(() => cleanup());

  it("greets with the operator fallback instead of stuffing the account email into the header", () => {
    render(
      <DashboardPage
        administrator={administrator}
        activities={[]}
        inProgressCount={0}
        readyForDeliveryCount={0}
        todayLabel="segunda-feira, 7 de setembro"
      />,
    );
    expect(screen.getByRole("heading", { name: "Olá, Coletor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /gmail\.com/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" }).closest("form")).toHaveAttribute(
      "action",
      "/api/auth/sign-out",
    );
    expect(screen.getByRole("img", { name: "Logo MJT Tornearia" })).toHaveAttribute(
      "src",
      "/logo/Logo_-_MJT-removebg-preview.png",
    );
    expect(screen.getByRole("heading", { name: /Organize a rota/ })).toHaveTextContent(
      "Organize a rota sem perder o controle.",
    );
    expect(screen.getByRole("link", { name: "Nova coleta" })).toHaveAttribute("href", "/coletas/nova");
  });

  it("greets with the given name from the profile", () => {
    render(
      <DashboardPage
        administrator={{ ...administrator, fullName: "João Marcelo Walk" }}
        activities={[]}
        inProgressCount={0}
        readyForDeliveryCount={0}
        todayLabel="segunda-feira, 7 de setembro"
      />,
    );
    expect(screen.getByRole("heading", { name: "Olá, João" })).toBeInTheDocument();
  });

  it("renders stacked activity cards with Pronto label", () => {
    render(
      <DashboardPage
        administrator={administrator}
        activities={[
          {
            id: "11111111-1111-1111-8111-111111111111",
            officialCode: "MJT-2026-000021",
            status: "collected",
            customerName: "Clínica Horizonte",
            createdAt: "2026-09-07T12:00:00.000Z",
          },
          {
            id: "22222222-2222-2222-8222-222222222222",
            officialCode: "MJT-2026-000017",
            status: "ready",
            customerName: "Casa Amaral",
            createdAt: "2026-09-07T11:00:00.000Z",
          },
        ]}
        inProgressCount={3}
        readyForDeliveryCount={1}
        todayLabel="quinta-feira, 14 de agosto"
      />,
    );

    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("1 pronta para entrega")).toBeInTheDocument();
    expect(screen.getByText("Clínica Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Casa Amaral")).toBeInTheDocument();
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(screen.queryByText("Ver rascunhos")).not.toBeInTheDocument();
    expect(screen.queryByText("Perfil Emissor MJT")).not.toBeInTheDocument();
  });
});
