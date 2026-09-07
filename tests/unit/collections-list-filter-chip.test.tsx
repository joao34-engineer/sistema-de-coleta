import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { Route } from "next";
import { CollectionsListFilterChip } from "@/_pages/collection-lifecycle/ui/collections-list-filter-chip";

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

import { useLinkStatus } from "next/link";

describe("CollectionsListFilterChip", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(useLinkStatus).mockReturnValue({ pending: false });
  });

  it("renders the current filter as a selected non-link", () => {
    const onPendingChange = vi.fn();
    render(
      <CollectionsListFilterChip
        href={"/coletas" as Route}
        label="Todos"
        isCurrent
        onPendingChange={onPendingChange}
      />,
    );

    expect(screen.getByText("Todos")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Todos")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("link", { name: "Todos" })).toBeNull();
  });

  it("renders an idle filter as a link and paints selected while pending", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: true });
    const onPendingChange = vi.fn();
    render(
      <CollectionsListFilterChip
        href={"/coletas?filter=collected" as Route}
        label="Coletadas"
        isCurrent={false}
        onPendingChange={onPendingChange}
      />,
    );

    const marker = screen.getByText("Coletadas");
    expect(screen.getByRole("link", { name: "Coletadas" })).toHaveAttribute("href", "/coletas?filter=collected");
    expect(marker).toHaveAttribute("data-pending", "true");
    expect(marker).toHaveAttribute("data-selected", "true");
    expect(marker).toHaveAttribute("aria-busy", "true");
  });

  it("keeps a non-current chip idle during SSR even if the router reports pending", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: true });
    const html = renderToString(
      <CollectionsListFilterChip
        href={"/coletas?filter=ready" as Route}
        label="Prontas"
        isCurrent={false}
        onPendingChange={() => undefined}
      />,
    );

    expect(html).toContain('data-pending="false"');
    expect(html).toContain('data-selected="false"');
    expect(html).toContain('aria-busy="false"');
  });
});
