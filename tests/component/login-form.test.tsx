import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginForm } from "@/_pages/login/ui/login-form";

describe("LoginForm", () => {
  it("renders accessible credentials fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});
