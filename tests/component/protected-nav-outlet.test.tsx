import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { resetNavPendingForTests, setStickyPendingPrefix } from "@/shared/ui/nav-pending";
import { ProtectedNavOutlet } from "@/shared/ui/protected-nav-outlet";

describe("ProtectedNavOutlet", () => {
  afterEach(() => {
    cleanup();
    resetNavPendingForTests();
  });

  it("shows the route skeleton while a bottom-nav tab is pending", async () => {
    vi.mocked(usePathname).mockReturnValue("/coletas");
    setStickyPendingPrefix("/dashboard");

    render(
      <ProtectedNavOutlet>
        <div>page content</div>
      </ProtectedNavOutlet>,
    );

    expect(await screen.findByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("renders children when the pathname already matches the pending prefix", async () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    setStickyPendingPrefix("/dashboard");

    render(
      <ProtectedNavOutlet>
        <div>page content</div>
      </ProtectedNavOutlet>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
    // After mount sync, pending clears because pathname matches — still children, no skeleton.
    expect(await screen.findByText("page content")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /Carregando/ })).not.toBeInTheDocument();
  });

  it("renders children when nothing is pending", () => {
    vi.mocked(usePathname).mockReturnValue("/coletas");

    render(
      <ProtectedNavOutlet>
        <div>page content</div>
      </ProtectedNavOutlet>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
