import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { renderHook } from "@testing-library/react";
import { useHydrated } from "@/shared/lib/use-hydrated";

function HydrationProbe() {
  const hydrated = useHydrated();
  return hydrated ? "client" : "server";
}

describe("useHydrated", () => {
  it("is false during SSR", () => {
    expect(renderToString(createElement(HydrationProbe))).toBe("server");
  });

  it("is true after a client render", () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });
});
