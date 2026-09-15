import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(() => ({ prefetch: vi.fn() })),
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
import { MobileBottomNav, resetMobileBottomNavStickyForTests } from "@/shared/ui/mobile-bottom-nav";

describe("MobileBottomNav", () => {
  afterEach(() => {
    cleanup();
    resetMobileBottomNavStickyForTests();
  });

  it("marks the matching tab with aria-current=page and the green active pill", () => {
    vi.mocked(usePathname).mockReturnValue("/coletas/abc");
    render(<MobileBottomNav />);

    const coletas = screen.getByRole("link", { name: /Coletas/ });
    expect(coletas).toHaveAttribute("aria-current", "page");
    const pill = coletas.querySelector("span span");
    expect(pill).toHaveStyle({
      backgroundColor: "var(--color-surface-green)",
      color: "var(--color-primary-strong)",
    });
    expect(screen.getByRole("link", { name: /Início/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /Configurações/ })).not.toHaveAttribute("aria-current");
  });

  it("moves the green active pill on pointer down before the route changes", () => {
    vi.mocked(usePathname).mockReturnValue("/coletas");
    render(<MobileBottomNav />);

    const inicio = screen.getByRole("link", { name: /Início/ });
    fireEvent.pointerDown(inicio);

    expect(inicio).toHaveAttribute("aria-current", "page");
    expect(inicio.querySelector("span span")).toHaveStyle({
      backgroundColor: "var(--color-surface-green)",
      color: "var(--color-primary-strong)",
    });
    expect(screen.getByRole("link", { name: /Coletas/ })).not.toHaveAttribute("aria-current");
  });

  it("keeps the optimistic green pill across remount while navigation is pending", async () => {
    vi.mocked(usePathname).mockReturnValue("/coletas");
    const { unmount } = render(<MobileBottomNav />);

    fireEvent.pointerDown(screen.getByRole("link", { name: /Início/ }));
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("aria-current", "page");

    unmount();
    vi.mocked(usePathname).mockReturnValue("/coletas");
    render(<MobileBottomNav />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByRole("link", { name: /Início/ }).querySelector("span span")).toHaveStyle({
      backgroundColor: "var(--color-surface-green)",
      color: "var(--color-primary-strong)",
    });
    expect(screen.getByRole("link", { name: /Coletas/ })).not.toHaveAttribute("aria-current");
  });
});
