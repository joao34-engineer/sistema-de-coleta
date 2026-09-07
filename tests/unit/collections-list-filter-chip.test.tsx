import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Route } from "next";
import { CollectionsListFilterChip } from "@/_pages/collection-lifecycle/ui/collections-list-filter-chip";

vi.mock("next/link", async () => {
  const React = await import("react");
  const MockLink = ({
    href,
    children,
    className,
    prefetch,
    ...rest
  }: Readonly<{
    href: string;
    children: React.ReactNode;
    className?: string;
    prefetch?: boolean;
  }>) =>
    React.createElement(
      "a",
      { href, className, "data-prefetch": prefetch === true ? "true" : "false", ...rest },
      children,
    );

  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: vi.fn(() => ({ pending: false })),
  };
});

describe("CollectionsListFilterChip", () => {
  afterEach(() => cleanup());

  it("renders the selected filter as a non-link", () => {
    render(
      <CollectionsListFilterChip
        href={"/coletas" as Route}
        label="Todos"
        isSelected
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Todos")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Todos")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("link", { name: "Todos" })).toBeNull();
  });

  it("renders an idle filter as a prefetching link", () => {
    const onSelect = vi.fn();
    render(
      <CollectionsListFilterChip
        href={"/coletas?filter=collected" as Route}
        label="Coletadas"
        isSelected={false}
        onSelect={onSelect}
      />,
    );

    const link = screen.getByRole("link", { name: "Coletadas" });
    expect(link).toHaveAttribute("href", "/coletas?filter=collected");
    expect(link).toHaveAttribute("data-prefetch", "true");
    expect(link).toHaveAttribute("data-selected", "false");
    link.click();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
