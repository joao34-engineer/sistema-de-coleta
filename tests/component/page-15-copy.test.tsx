import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicVerificationWaitPage } from "@/_pages/collection-documents/ui/public-verification-wait-page";
import { DocumentShareUnavailablePage } from "@/_pages/collection-documents/ui/document-share-page";
import { EnvMisconfiguredPanel } from "@/shared/ui/env-misconfigured-panel";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

describe("public wait and share copy (page 15)", () => {
  afterEach(() => cleanup());

  it("uses Q05 title Aguarde antes de consultar without an Aguardar button", () => {
    render(<PublicVerificationWaitPage variant="rate_limited" retryAfterSeconds={12} />);
    expect(screen.getByRole("heading", { name: "Aguarde antes de consultar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aguardar" })).toBeNull();
    expect(screen.getByText("Tente novamente em 12 segundos.")).toBeInTheDocument();
  });

  it("uses Q06 title Consulta indisponível", () => {
    render(<PublicVerificationWaitPage variant="unavailable" />);
    expect(screen.getByRole("heading", { name: "Consulta indisponível" })).toBeInTheDocument();
  });

  it("keeps SH02 invalid-hex copy without expired or revoked wording", () => {
    render(<DocumentShareUnavailablePage />);
    expect(screen.getByText("O link é inválido.")).toBeInTheDocument();
    expect(screen.queryByText(/expirou|revogado/i)).toBeNull();
  });

  it("ENV01 keeps honest title and Entendi reloads the page", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(<EnvMisconfiguredPanel />);
    expect(screen.getByRole("heading", { name: "Ambiente não configurado" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Não foi possível enviar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
