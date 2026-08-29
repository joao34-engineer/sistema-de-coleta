import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Route } from "next";
import { buttonClassName } from "@/shared/ui/button";

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

import { PendingNavLink } from "@/shared/ui/pending-nav-link";

function DashboardPrimaryCtas() {
  return (
    <div>
      <PendingNavLink
        href={"/coletas/nova" as Route}
        className={buttonClassName({ variant: "primary", size: "md" })}
        contentClassName="flex w-full items-center justify-center"
      >
        Nova coleta
      </PendingNavLink>
      <PendingNavLink
        href={"/configuracoes/empresa" as Route}
        className={buttonClassName({ variant: "secondary", size: "md", className: "w-full" })}
        contentClassName="flex w-full items-center justify-center"
      >
        Configurações da Empresa
      </PendingNavLink>
    </div>
  );
}

describe("dashboard CTA links", () => {
  it("renders Nova coleta and Empresa as single links without nested buttons", () => {
    render(<DashboardPrimaryCtas />);

    expect(screen.getByRole("link", { name: "Nova coleta" })).toHaveAttribute("href", "/coletas/nova");
    expect(screen.queryByRole("button", { name: "Nova coleta" })).toBeNull();

    expect(screen.getByRole("link", { name: "Configurações da Empresa" })).toHaveAttribute(
      "href",
      "/configuracoes/empresa",
    );
    expect(screen.queryByRole("button", { name: "Configurações da Empresa" })).toBeNull();
  });
});
