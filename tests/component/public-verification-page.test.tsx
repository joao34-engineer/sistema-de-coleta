import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PublicVerificationPage } from "@/_pages/collection-documents/ui/public-verification-page";
import { PublicVerificationWaitPage } from "@/_pages/collection-documents/ui/public-verification-wait-page";
import type { PublicVerificationDTO } from "@/_pages/collection-documents/model/public-verification";

const verificationToken = "a".repeat(64);

const verification: PublicVerificationDTO = {
  authentic: true,
  officialCode: "MJT-2026-000123",
  issuedAt: "2026-08-20T15:30:00.000Z",
  status: "collected",
  organization: { name: "MJT Oficina" },
  documentVersion: 1,
};

describe("PublicVerificationPage", () => {
  afterEach(() => cleanup());

  it("shows the public minimum for an authentic guide", () => {
    render(<PublicVerificationPage verification={verification} />);

    expect(screen.getByRole("heading", { name: "Guia autêntica" })).toBeInTheDocument();
    expect(screen.getByText("MJT-2026-000123")).toBeInTheDocument();
    expect(screen.getByText("MJT Oficina")).toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(screen.queryByText("5551999999999")).not.toBeInTheDocument();
  });

  it("keeps a canceled guide verifiable", () => {
    render(<PublicVerificationPage verification={{ ...verification, authentic: false, status: "canceled" }} />);
    expect(screen.getByRole("heading", { name: "Guia cancelada" })).toBeInTheDocument();
    expect(screen.getByText(/permanece verificável/i)).toBeInTheDocument();
  });

  it("does not reveal details for an unknown token", () => {
    render(<PublicVerificationPage verification={null} />);
    expect(screen.getByRole("heading", { name: "Registro não encontrado" })).toBeInTheDocument();
    expect(screen.queryByText("MJT-2026-000123")).not.toBeInTheDocument();
  });

  it("shows an authentic in_service guide instead of not found", () => {
    render(<PublicVerificationPage verification={{ ...verification, status: "in_service" }} />);
    expect(screen.getByRole("heading", { name: "Guia autêntica" })).toBeInTheDocument();
    expect(screen.getByText("MJT-2026-000123")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Registro não encontrado" })).not.toBeInTheDocument();
  });
});

describe("PublicVerificationWaitPage", () => {
  afterEach(() => cleanup());

  it("shows the rate-limit wait copy without leaking verification data", () => {
    render(<PublicVerificationWaitPage variant="rate_limited" retryAfterSeconds={42} />);
    expect(screen.getByRole("heading", { name: "Aguarde antes de consultar novamente." })).toBeInTheDocument();
    expect(screen.getByText(/42 segundos/)).toBeInTheDocument();
    expect(screen.queryByText("MJT-2026-000123")).not.toBeInTheDocument();
    expect(screen.queryByText(verificationToken)).not.toBeInTheDocument();
  });

  it("shows the unavailable copy without leaking verification data", () => {
    render(<PublicVerificationWaitPage variant="unavailable" />);
    expect(screen.getByRole("heading", { name: "Consulta temporariamente indisponível." })).toBeInTheDocument();
    expect(screen.queryByText("MJT-2026-000123")).not.toBeInTheDocument();
    expect(screen.queryByText(verificationToken)).not.toBeInTheDocument();
  });
});
