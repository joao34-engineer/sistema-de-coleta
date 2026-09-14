import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureStepFallback } from "@/_pages/collection-drafts/ui/capture-step-fallback";

vi.mock("next/navigation", () => ({
  usePathname: () => "/coletas/nova",
}));

describe("CaptureStepFallback", () => {
  afterEach(() => cleanup());

  it("shows the S01 in-page loading panel with honest copy and Aguarde", () => {
    render(<CaptureStepFallback />);

    expect(screen.getByRole("heading", { name: "Carregando a coleta" })).toBeInTheDocument();
    expect(screen.getByText("Aguarde enquanto os dados da coleta são carregados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aguarde" })).toBeDisabled();
    expect(screen.queryByText("Não foi possível enviar")).not.toBeInTheDocument();
  });
});
