import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkshopHubSubmit } from "@/_pages/collection-operations/model/use-workshop-hub-submit";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const collectionId = "11111111-1111-4111-8111-111111111111";

describe("useWorkshopHubSubmit", () => {
  afterEach(() => {
    push.mockReset();
  });

  it("pushes the hub after a successful mutation", async () => {
    const { result } = renderHook(() => useWorkshopHubSubmit(collectionId));
    const mutate = vi.fn(async () => ({ ok: true as const }));

    act(() => {
      result.current.submit(mutate);
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/coletas/${collectionId}`);
    });
    expect(mutate).toHaveBeenCalledOnce();
    expect(result.current.error).toBeNull();
  });

  it("stays on the form and surfaces the action error", async () => {
    const { result } = renderHook(() => useWorkshopHubSubmit(collectionId));
    const mutate = vi.fn(async () => ({ ok: false as const, error: "Versão desatualizada." }));

    act(() => {
      result.current.submit(mutate);
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Versão desatualizada.");
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores a second tap while the first mutation is in flight", async () => {
    const { result } = renderHook(() => useWorkshopHubSubmit(collectionId));
    let release: ((value: { ok: true }) => void) | undefined;
    const mutate = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          release = resolve;
        }),
    );

    act(() => {
      result.current.submit(mutate);
      result.current.submit(mutate);
    });

    expect(mutate).toHaveBeenCalledOnce();
    await act(async () => {
      release?.({ ok: true });
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
  });
});
