import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentViewerPage } from "@/_pages/collection-documents/ui/document-viewer-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe("DocumentViewerPage", () => {
  afterEach(() => cleanup());

  it("shows download and a preview control without mounting the iframe", () => {
    render(
      <DocumentViewerPage
        collectionId="11111111-1111-4111-8111-111111111111"
        documentId="22222222-2222-4222-8222-222222222222"
        hasPdf
      />,
    );

    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pré-visualizar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar/i })).toBeInTheDocument();
    expect(screen.getByText("Integridade Preservada")).toBeInTheDocument();
  });

  it("shows generating status and hides the iframe when the PDF is missing", () => {
    render(
      <DocumentViewerPage
        collectionId="11111111-1111-4111-8111-111111111111"
        documentId="22222222-2222-4222-8222-222222222222"
        hasPdf={false}
        pdfJobStatus="queued"
      />,
    );

    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Baixar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF/i);
    expect(screen.getByText("Gerando PDF")).toBeInTheDocument();
  });

  it("shows honest failure and retry when the PDF job failed", () => {
    render(
      <DocumentViewerPage
        collectionId="11111111-1111-4111-8111-111111111111"
        documentId="22222222-2222-4222-8222-222222222222"
        hasPdf={false}
        pdfJobStatus="failed"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível gerar o PDF/i);
    expect(screen.queryByRole("heading", { name: "Gerando o PDF" })).not.toBeInTheDocument();
    expect(screen.getByText("Falha na geração")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
