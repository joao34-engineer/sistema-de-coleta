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

  it("renders a static letterhead from list DTO fields without a PDF iframe", () => {
    render(<CollectionDocumentLetterhead officialCode="MJT-2026-000021" version={2} />);

    expect(screen.getByRole("heading", { name: "GUIA DE COLETA" })).toBeInTheDocument();
    expect(screen.getByText("MJT-2026-000021")).toBeInTheDocument();
    expect(screen.getByText("Versão 2")).toBeInTheDocument();
    expect(screen.getByText("{{RAZAO_SOCIAL_MJT}} · {{CNPJ_MJT}}")).toBeInTheDocument();
    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.queryByText("Clínica Horizonte")).not.toBeInTheDocument();
  });
});
