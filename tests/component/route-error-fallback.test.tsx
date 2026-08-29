import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorFallback } from "@/_app/errors";

describe("RouteErrorFallback", () => {
  it("shows a safe message, digest, and retry without leaking error.message", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("secret_stack_cpf_52998224725"), { digest: "abc123digest" });

    render(<RouteErrorFallback error={error} reset={reset} />);

    expect(screen.getByText("Não foi possível carregar esta tela.")).toBeInTheDocument();
    expect(screen.getByText(/Ref: abc123digest/)).toBeInTheDocument();
    expect(screen.queryByText(/secret_stack/)).not.toBeInTheDocument();
    expect(screen.queryByText(/52998224725/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
