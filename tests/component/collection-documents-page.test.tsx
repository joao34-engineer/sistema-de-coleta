import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CollectionDocumentsPage } from "@/_pages/collection-documents/ui/collection-documents-page";

describe("CollectionDocumentsPage", () => {
  afterEach(() => cleanup());

  it("shows immutable versions and only available artifact actions", () => {
    render(<CollectionDocumentsPage collectionId="11111111-1111-4111-8111-111111111111" officialCode="MJT-2026-000001" documents={[{
      id: "22222222-2222-4222-8222-222222222222",
      collectionId: "11111111-1111-4111-8111-111111111111",
      version: 2,
      status: "snapshot_ready",
      issuedAt: "2026-08-20T15:30:00.000Z",
      artifacts: [{ id: "33333333-3333-4333-8333-333333333333", type: "pdf", contentType: "application/pdf", byteSize: 128, createdAt: "2026-08-20T15:31:00.000Z" }],
    }]} />);

    expect(screen.getByRole("heading", { name: "Versão 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar PDF/i })).toHaveAttribute("href", expect.stringContaining("artifact=pdf"));
    expect(screen.queryByRole("link", { name: /Baixar QR/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar link seguro" })).toBeInTheDocument();
  });

  it("explains when a collection has no generated document", () => {
    render(<CollectionDocumentsPage collectionId="11111111-1111-4111-8111-111111111111" officialCode={null} documents={[]} />);
    expect(screen.getByText("Nenhum documento disponível para esta coleta.")).toBeInTheDocument();
  });
});
