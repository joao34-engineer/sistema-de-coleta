import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pwaCopy } from "@/_app/pwa/model/pwa-copy";
import { PwaUpdateBanner } from "@/_app/pwa/ui/pwa-update-banner";

describe("PwaUpdateBanner with pending work", () => {
  afterEach(() => cleanup());

  it("warns before reload when there is pending sync work", () => {
    render(<PwaUpdateBanner hasPendingWork onConfirm={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(pwaCopy.updatePendingDescription)).toBeInTheDocument();
  });

  it("keeps the default copy when nothing is pending", () => {
    render(<PwaUpdateBanner onConfirm={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(pwaCopy.updateDescription)).toBeInTheDocument();
  });

  it("still allows postponing the update", () => {
    const onDismiss = vi.fn();
    render(<PwaUpdateBanner hasPendingWork onConfirm={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: pwaCopy.updateDismiss }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
