import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginForm } from "@/_pages/login/ui/login-form";

describe("LoginForm", () => {
  it("renders accessible credentials fields and toggle button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/E-mail Corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no sistema/i })).toBeEnabled();
  });
});
