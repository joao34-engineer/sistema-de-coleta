import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DocumentShareAvailablePage,
  DocumentShareUnavailablePage,
} from "@/_pages/collection-documents/ui/document-share-page";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

vi.mock("next/link", async () => {
  const React = await import("react");
  const MockLink = ({
    href,
    children,
    className,
  }: Readonly<{ href: string; children: React.ReactNode; className?: string }>) =>
    React.createElement("a", { href, className }, children);

  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: vi.fn(() => ({ pending: false })),
  };
});

const shareToken = "ab".repeat(32);

describe("DocumentShareAvailablePage", () => {
  afterEach(() => cleanup());

  it("shows the protected-document panel and download without inspecting the token", () => {
    render(<DocumentShareAvailablePage shareToken={shareToken} />);

    expect(screen.getByText("Link seguro")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documento protegido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      `/d/${shareToken}/download`,
    );
    expect(screen.getByText(/cada download consome uma utilização/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "MJT Tornearia" })).toHaveAttribute(
      "src",
      "/logo/Logo_-_MJT-removebg-preview.png",
    );
  });
});

describe("DocumentShareUnavailablePage", () => {
  afterEach(() => cleanup());

  it("skins the invalid-shape branch without extra PII", () => {
    render(<DocumentShareUnavailablePage />);

    expect(screen.getByRole("heading", { name: "Link indisponível" })).toBeInTheDocument();
    expect(screen.getByText("O link é inválido.")).toBeInTheDocument();
    expect(screen.queryByText(/expirou ou foi revogado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
