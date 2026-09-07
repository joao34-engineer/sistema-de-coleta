import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CollectionListItemDTO } from "@/_pages/collection-lifecycle/model/contracts";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas",
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  const MockLink = ({
    href,
    children,
    className,
    ...rest
  }: Readonly<{
    href: string;
    children: React.ReactNode;
    className?: string;
  }>) => React.createElement("a", { href, className, ...rest }, children);

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
    expect(screen.getByRole("link", { name: "Coletadas" })).toHaveAttribute("href", "/coletas?filter=collected");
    expect(screen.getByRole("link", { name: "Em reparo" })).toHaveAttribute("href", "/coletas?filter=in_repair");
    expect(screen.getByRole("link", { name: "Prontas" })).toHaveAttribute("href", "/coletas?filter=ready");
    expect(screen.queryByRole("button", { name: "Coletadas" })).toBeNull();
  });

  it("preserves the search term on filter hrefs", () => {
    render(
      <CollectionsListPage
        initialItems={[collectedItem]}
        searchTerm="Maria"
        selectedFilter="collected"
      />,
    );

    expect(screen.getByText("Coletadas")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Todos" })).toHaveAttribute("href", "/coletas?q=Maria");
    expect(screen.getByRole("link", { name: "Em reparo" })).toHaveAttribute(
      "href",
      "/coletas?q=Maria&filter=in_repair",
    );
  });
});
