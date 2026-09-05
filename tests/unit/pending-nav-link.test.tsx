import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { Route } from "next";

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
  }>) =>
    React.createElement("a", { href, className, ...rest }, children);

  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: vi.fn(() => ({ pending: false })),
  };
});

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";

describe("PendingNavLink", () => {
  it("marks idle state when not pending", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: false });
    render(
      <PendingNavLink href={"/dashboard" as Route} className="nav-link">
        Início
      </PendingNavLink>,
    );

    const marker = screen.getByText("Início");
    expect(marker).toHaveAttribute("data-pending", "false");
    expect(marker).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/dashboard");
  });

  it("applies pending markers and class when navigating", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: true });
    render(
      <PendingNavLink
        href={"/coletas" as Route}
        pendingClassName="is-opening"
        contentClassName="inner"
      >
        Coletas
      </PendingNavLink>,
    );

    const marker = screen.getByText("Coletas");
    expect(marker).toHaveAttribute("data-pending", "true");
    expect(marker).toHaveAttribute("aria-busy", "true");
    expect(marker.className).toContain("is-opening");
    expect(marker.className).toContain("inner");
    expect(Link).toBeDefined();
  });

  it("keeps pending markers idle during SSR even if the router reports pending", () => {
    vi.mocked(useLinkStatus).mockReturnValue({ pending: true });
    const html = renderToString(
      <PendingNavLink href={"/dashboard" as Route} pendingClassName="is-opening">
        Início
      </PendingNavLink>,
    );

    expect(html).toContain('data-pending="false"');
    expect(html).toContain('aria-busy="false"');
    expect(html).not.toContain("is-opening");
  });
});
