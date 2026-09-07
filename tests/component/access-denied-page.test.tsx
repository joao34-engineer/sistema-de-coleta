import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AccessDeniedPage } from "../../src/_pages/dashboard/ui/access-denied-page";

describe("AccessDeniedPage", () => {
  afterEach(() => cleanup());

  it("renders the unauthorized title and explanation", () => {
    render(<AccessDeniedPage />);
    expect(screen.getByRole("heading", { name: /Acesso não autorizado/i })).toBeInTheDocument();
    expect(screen.getByText(/Esta conta não possui um vínculo administrativo ativo com a MJT./i)).toBeInTheDocument();
  });

  it("posts Sair to the sign-out route instead of a Server Action", () => {
    render(<AccessDeniedPage />);
    const button = screen.getByRole("button", { name: /Sair/i });
    expect(button).toBeInTheDocument();
    expect(button.closest("form")).toHaveAttribute("action", "/api/auth/sign-out");
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });
});
