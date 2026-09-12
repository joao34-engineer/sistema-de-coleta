import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
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

import { usePathname } from "next/navigation";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";

describe("MobileBottomNav", () => {
  afterEach(() => cleanup());

  it("marks the matching tab with aria-current=page on the client", () => {
    vi.mocked(usePathname).mockReturnValue("/coletas/abc");
    render(<MobileBottomNav />);

    expect(screen.getByRole("link", { name: /Coletas/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Início/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Configurações/ })).not.toHaveAttribute("aria-current");
  });

  it("keeps aria-current during SSR without waiting for hydration", () => {
    vi.mocked(usePathname).mockReturnValue("/configuracoes/empresa");
    const html = renderToString(<MobileBottomNav />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Configurações");
  });
});
