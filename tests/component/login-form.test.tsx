import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/_pages/login/ui/login-form";

vi.mock("@/_pages/login/api/actions", () => ({
  signInAction: vi.fn(),
}));

describe("LoginForm", () => {
  it("renders accessible credentials fields and toggle button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/E-mail Corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no sistema/i })).toBeEnabled();
  });
});
