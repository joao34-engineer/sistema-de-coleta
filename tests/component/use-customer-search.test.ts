import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  useCustomerSearch,
} from "@/_pages/collection-drafts/model/use-customer-search";

type CustomerView = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
}>;

type SearchResult = { ok: true; customers: readonly CustomerView[] } | { ok: false; error: string };

const maria: CustomerView = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  displayName: "Maria Silva",
  taxId: "52998224725",
  phone: "11988888888",
};

const mario: CustomerView = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  displayName: "Mario Souza",
  taxId: "39053344705",
  phone: "11977777777",
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolveFn: ((value: T) => void) | undefined;
  const promise = new Promise<T>((res) => {
    resolveFn = res;
  });
  return {
    promise,
    resolve: (value: T) => {
      resolveFn?.(value);
    },
  };
}

describe("useCustomerSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fires one search after a pause for a five-letter name", async () => {
    const search = vi.fn(async (): Promise<SearchResult> => ({
      ok: true,
      customers: [maria],
    }));
    const { rerender, result } = renderHook(
      ({ query }: { query: string }) => useCustomerSearch({ query, online: true, search }),
      { initialProps: { query: "" } },
    );

    for (const query of ["M", "Ma", "Mar", "Mari", "Maria"]) {
      rerender({ query });
    }

    expect(search).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith("Maria");
    expect(result.current.results).toEqual([maria]);
  });

  it("does not search under two characters and keeps results empty", async () => {
    const search = vi.fn(async (): Promise<SearchResult> => ({
      ok: true,
      customers: [maria],
    }));
    renderHook(() => useCustomerSearch({ query: "M", online: true, search }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("ignores a slow first response after a newer query", async () => {
    const first = deferred<SearchResult>();
    const search = vi.fn(async (): Promise<SearchResult> => ({
      ok: true,
      customers: [],
    }));
    search.mockImplementationOnce(async () => first.promise);
    search.mockResolvedValueOnce({ ok: true, customers: [mario] });

    const { rerender, result } = renderHook(
      ({ query }: { query: string }) => useCustomerSearch({ query, online: true, search }),
      { initialProps: { query: "Maria" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });
    rerender({ query: "Mario" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });

    await act(async () => {
      first.resolve({ ok: true, customers: [maria] });
    });
    expect(result.current.results).toEqual([mario]);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("does not apply a late result after unmount", async () => {
    const pending = deferred<SearchResult>();
    const search = vi.fn(async (): Promise<SearchResult> => pending.promise);
    const { unmount, result } = renderHook(() =>
      useCustomerSearch({ query: "Maria", online: true, search }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });
    unmount();
    await act(async () => {
      pending.resolve({ ok: true, customers: [maria] });
    });
    expect(result.current.results).toEqual([]);
  });

  it("clears results and ignores in-flight search when going offline", async () => {
    const pending = deferred<SearchResult>();
    const search = vi.fn(async (): Promise<SearchResult> => pending.promise);
    const { rerender, result } = renderHook(
      ({ online }: { online: boolean }) => useCustomerSearch({ query: "Maria", online, search }),
      { initialProps: { online: true } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUSTOMER_SEARCH_DEBOUNCE_MS);
    });
    rerender({ online: false });
    await act(async () => {
      pending.resolve({ ok: true, customers: [maria] });
    });
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });
});
