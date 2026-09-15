import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("closes on backdrop click and Escape", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        title="Descartar"
        body="Confirma?"
        cancelLabel="Cancelar"
        confirmLabel="Descartar"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
