import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pwaCopy } from "@/_app/pwa/model/pwa-copy";
import { PwaUpdateBanner } from "@/_app/pwa/ui/pwa-update-banner";

describe("PwaUpdateBanner", () => {
  afterEach(() => cleanup());

  it("fires onConfirm when the operator accepts the update", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<PwaUpdateBanner onConfirm={onConfirm} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: pwaCopy.updateConfirm }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("fires onDismiss when the operator postpones the update", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<PwaUpdateBanner onConfirm={onConfirm} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: pwaCopy.updateDismiss }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
