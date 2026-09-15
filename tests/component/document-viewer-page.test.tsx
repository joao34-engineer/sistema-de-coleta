import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentViewerPage } from "@/_pages/collection-documents/ui/document-viewer-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/11111111-1111-4111-8111-111111111111/documentos/22222222-2222-4222-8222-222222222222",
}));

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

const collectionId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

describe("DocumentViewerPage", () => {
  afterEach(() => cleanup());

  it("shows the M10 letterhead and gated preview without mounting the iframe", () => {
    render(
      <DocumentViewerPage
        collectionId={collectionId}
        documentId={documentId}
        hasPdf
        officialCode="MJT-2026-000021"
        version={2}
        customerName="Clínica Horizonte"
        locationDescription="Oficina central"
        items={[{ description: "Eixo", quantity: 1 }]}
        signerName="Ana Souza"
      />,
    );

    expect(screen.getByRole("heading", { name: "Guia de coleta" })).toBeInTheDocument();
    expect(screen.getByText("Visualização")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GUIA DE COLETA" })).toBeInTheDocument();
    expect(screen.getByText("MJT-2026-000021")).toBeInTheDocument();
    expect(screen.getByText("Clínica Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Local: Oficina central")).toBeInTheDocument();
    expect(screen.getByText("1× Eixo")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Signatário:")).toBeInTheDocument();
    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pré-visualizar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      `/api/documents/${documentId}/download?artifact=pdf`,
    );
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar link seguro" })).not.toBeInTheDocument();
  });

  it("reveals the existing share actions after Compartilhar", () => {
    render(
      <DocumentViewerPage
        collectionId={collectionId}
        documentId={documentId}
        hasPdf
        officialCode="MJT-2026-000021"
        version={2}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect(screen.getByRole("button", { name: "Criar link seguro" })).toBeInTheDocument();
  });

  it("shows generating status and hides the iframe when the PDF is missing", () => {
    render(
      <DocumentViewerPage
        collectionId={collectionId}
        documentId={documentId}
        hasPdf={false}
        officialCode="MJT-2026-000021"
        version={1}
        pdfJobStatus="queued"
      />,
    );

    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Baixar PDF" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF/i);
    expect(screen.getByRole("button", { name: "Aguarde" })).toBeDisabled();
  });

  it("shows honest failure and retry when the PDF job failed", () => {
    render(
      <DocumentViewerPage
        collectionId={collectionId}
        documentId={documentId}
        hasPdf={false}
        officialCode="MJT-2026-000021"
        version={1}
        pdfJobStatus="failed"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível gerar o PDF/i);
    expect(screen.queryByRole("heading", { name: "Gerando o PDF" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
