import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionDocumentLetterhead } from "@/_pages/collection-documents/ui/collection-document-letterhead";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

describe("CollectionDocumentLetterhead", () => {
  afterEach(() => cleanup());

  it("renders code/version and issuer placeholders without a PDF iframe", () => {
    render(<CollectionDocumentLetterhead officialCode="MJT-2026-000021" version={2} />);

    expect(screen.getByRole("heading", { name: "GUIA DE COLETA" })).toBeInTheDocument();
    expect(screen.getByText("MJT-2026-000021")).toBeInTheDocument();
    expect(screen.getByText("Versão 2")).toBeInTheDocument();
    expect(screen.getByText("{{RAZAO_SOCIAL_MJT}} · {{CNPJ_MJT}}")).toBeInTheDocument();
    expect(screen.getByText("{{TEXTO_JURIDICO_RECIBO}}")).toBeInTheDocument();
    expect(screen.getByText("[ QR ]")).toBeInTheDocument();
    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
  });

  it("fills cliente, local, itens and signatário from detail props", () => {
    render(
      <CollectionDocumentLetterhead
        officialCode="MJT-2026-000021"
        version={2}
        customerName="Clínica Horizonte"
        locationDescription="Sala 3 — torre A"
        items={[
          { description: "Eixo hidráulico", quantity: 2 },
          { description: "Vedação", quantity: 1 },
        ]}
        signerName="Ana Souza"
      />,
    );

    expect(screen.getByText("Clínica Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Local: Sala 3 — torre A")).toBeInTheDocument();
    expect(screen.getByText("2× Eixo hidráulico")).toBeInTheDocument();
    expect(screen.getByText("1× Vedação")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Signatário:")).toBeInTheDocument();
    expect(screen.getByText("{{RAZAO_SOCIAL_MJT}} · {{CNPJ_MJT}}")).toBeInTheDocument();
  });
});
