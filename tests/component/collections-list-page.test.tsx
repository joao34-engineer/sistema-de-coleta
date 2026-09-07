import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CollectionListItemDTO } from "@/_pages/collection-lifecycle/model/contracts";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/coletas",
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    require("react").createElement("img", { src, alt }),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  const MockLink = ({
    href,
    children,
    className,
    prefetch,
    onClick,
    ...rest
  }: Readonly<{
    href: string;
    children: React.ReactNode;
    className?: string;
    prefetch?: boolean;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }>) =>
    React.createElement(
      "a",
      {
        href,
        className,
        "data-prefetch": prefetch === true ? "true" : "false",
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onClick?.(event);
        },
        ...rest,
      },
      children,
    );

  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: vi.fn(() => ({ pending: false })),
  };
});

const collectedItem: CollectionListItemDTO = {
  id: "11111111-1111-1111-8111-111111111111",
  officialCode: "MJT-2026-000001",
  status: "collected",
  customerName: "Maria Silva",
  customerTaxId: "52998224725",
  customerPhone: "11999998888",
  collectedAt: "2026-09-07T12:00:00.000Z",
  createdAt: "2026-09-07T12:00:00.000Z",
  rowVersion: 1,
};

describe("CollectionsListPage filter chips", () => {
  afterEach(() => cleanup());

  it("keeps the current chip as selected text and the others as filter links", () => {
    render(
      <CollectionsListPage initialItems={[collectedItem]} selectedFilter="all" />,
    );

    expect(screen.getByText("Todos")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Todos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Coletada" })).toHaveAttribute("href", "/coletas?filter=collected");
    expect(screen.getByRole("link", { name: "Em reparo" })).toHaveAttribute("href", "/coletas?filter=in_repair");
    expect(screen.getByRole("link", { name: "Pronta" })).toHaveAttribute("href", "/coletas?filter=ready");
    expect(screen.getByRole("link", { name: "Rascunho" })).toHaveAttribute("href", "/coletas?filter=draft");
    expect(screen.getByRole("link", { name: "Faturada" })).toHaveAttribute("href", "/coletas?filter=invoiced");
    expect(screen.getByRole("link", { name: "Entrega parcial" })).toHaveAttribute("href", "/coletas?filter=partial_delivery");
    expect(screen.getByRole("link", { name: "Cancelada" })).toHaveAttribute("href", "/coletas?filter=canceled");
    expect(screen.queryByRole("button", { name: "Coletada" })).toBeNull();
    expect(screen.getByRole("img", { name: "Logo MJT Tornearia" })).toHaveAttribute(
      "src",
      "/logo/Logo_-_MJT-removebg-preview.png",
    );
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar por número ou cliente")).toBeInTheDocument();
  });

  it("preserves the search term on filter hrefs", () => {
    render(
      <CollectionsListPage
        initialItems={[collectedItem]}
        searchTerm="Maria"
        selectedFilter="collected"
      />,
    );

    expect(screen.getByText("Coletada", { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Todos" })).toHaveAttribute("href", "/coletas?q=Maria");
    expect(screen.getByRole("link", { name: "Em reparo" })).toHaveAttribute(
      "href",
      "/coletas?q=Maria&filter=in_repair",
    );
  });

  it("moves the selected pill immediately on tap without leaving two selected chips", () => {
    render(
      <CollectionsListPage initialItems={[collectedItem]} selectedFilter="all" />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Coletada" }));

    expect(screen.getByText("Coletada", { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Coletada" })).toBeNull();
    expect(screen.getByRole("link", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Todos" })).not.toHaveAttribute("aria-current");
  });
});
