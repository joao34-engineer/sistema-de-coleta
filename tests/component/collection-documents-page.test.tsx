import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionDocumentsPage } from "@/_pages/collection-documents/ui/collection-documents-page";
import { buildShareText } from "@/_pages/collection-documents/ui/whatsapp-share-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/11111111-1111-4111-8111-111111111111/documentos",
}));

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
    expect(screen.queryByText(/PDF pendente/i)).not.toBeInTheDocument();
  });

  it("shows an honest PDF pendente panel when the document has no PDF artifact", () => {
    render(<CollectionDocumentsPage collectionId="11111111-1111-4111-8111-111111111111" officialCode="MJT-2026-000001" documents={[{
      id: "22222222-2222-4222-8222-222222222222",
      collectionId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      status: "snapshot_ready",
      issuedAt: "2026-08-20T15:30:00.000Z",
      artifacts: [],
    }]} />);

    expect(screen.getByRole("heading", { name: "Versão 1" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Baixar PDF/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF da guia/i);
    expect(screen.getByRole("status")).toHaveTextContent(/WhatsApp/i);
    expect(screen.queryByRole("button", { name: "Criar link seguro" })).not.toBeInTheDocument();
  });

  it("explains when a collection has no generated document", () => {
    render(<CollectionDocumentsPage collectionId="11111111-1111-4111-8111-111111111111" officialCode={null} documents={[]} />);
    expect(screen.getByText("Nenhum documento disponível")).toBeInTheDocument();
    expect(screen.getByText(/Rascunho sem guia emitida\. Finalize/i)).toBeInTheDocument();
  });

  it("builds WhatsApp / native share text with /d/{token} only, never the authenticated download path", () => {
    const shareUrl = "https://mjt.example.com/d/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const text = buildShareText(shareUrl, 2, "MJT-2026-000001");

    expect(text).toContain(shareUrl);
    expect(text).toContain("/d/");
    expect(text).not.toContain("/api/documents/");
    expect(text).not.toContain("artifact=pdf");
  });
});
