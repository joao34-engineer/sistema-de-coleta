import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useOnlineStatus } from "@/shared/lib/use-online-status";

describe("useOnlineStatus", () => {
  afterEach(() => cleanup());

  it("returns true on the server snapshot", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });
});
