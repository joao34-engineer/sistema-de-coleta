import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentViewerPage } from "@/_pages/collection-documents/ui/document-viewer-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe("DocumentViewerPage", () => {
  afterEach(() => cleanup());

  it("shows the PDF iframe and download when the artifact exists", () => {
    render(
      <DocumentViewerPage
        collectionId="11111111-1111-4111-8111-111111111111"
        documentId="22222222-2222-4222-8222-222222222222"
        hasPdf
      />,
    );

    expect(screen.getByTitle("Visualizador de PDF da Coleta MJT")).toHaveAttribute(
      "src",
      "/api/documents/22222222-2222-4222-8222-222222222222/download?artifact=pdf",
    );
    expect(screen.getByRole("link", { name: /Baixar/i })).toBeInTheDocument();
    expect(screen.getByText("Integridade Preservada")).toBeInTheDocument();
  });

  it("shows generating status and hides the iframe when the PDF is missing", () => {
    render(
      <DocumentViewerPage
        collectionId="11111111-1111-4111-8111-111111111111"
        documentId="22222222-2222-4222-8222-222222222222"
        hasPdf={false}
      />,
    );

    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Baixar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF da guia/i);
    expect(screen.getByText("Gerando PDF")).toBeInTheDocument();
  });
});
