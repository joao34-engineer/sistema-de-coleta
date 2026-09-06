import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccessDeniedPage } from "../../src/_pages/dashboard/ui/access-denied-page";

const mockSignOutAction = vi.fn();

vi.mock("@/shared/auth/actions", () => ({
  signOutAction: (...args: unknown[]) => mockSignOutAction(...args),
  initialSignOutState: { status: "idle" },
}));

describe("AccessDeniedPage", () => {
  afterEach(() => cleanup());

  it("renders the unauthorized title and explanation", () => {
    render(<AccessDeniedPage />);
    expect(screen.getByRole("heading", { name: /Acesso não autorizado/i })).toBeInTheDocument();
    expect(screen.getByText(/Esta conta não possui um vínculo administrativo ativo com a MJT./i)).toBeInTheDocument();
  });

  it("renders a Sair button that submits the sign-out action", async () => {
    mockSignOutAction.mockResolvedValue({ status: "idle" });
    render(<AccessDeniedPage />);

    const button = screen.getByRole("button", { name: /Sair/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() => expect(mockSignOutAction).toHaveBeenCalled());
  });

  it("displays an alert when sign-out returns an error", async () => {
    mockSignOutAction.mockResolvedValue({ status: "error", message: "Não foi possível encerrar a sessão. Tente novamente." });
    render(<AccessDeniedPage />);

    const button = screen.getByRole("button", { name: /Sair/i });
    fireEvent.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Não foi possível encerrar a sessão/i);
  });
});
