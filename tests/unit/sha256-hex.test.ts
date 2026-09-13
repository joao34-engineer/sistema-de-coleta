import { describe, expect, it } from "vitest";
import { digestLifecycleRequest, digestSha256 } from "@/shared/lib/file/sha256-hex";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("digestSha256", () => {
  it("returns the same lowercase hex for identical File bytes", async () => {
    const first = await digestSha256(new File([pngBytes], "a.png", { type: "image/png" }));
    const second = await digestSha256(new File([pngBytes], "b.png", { type: "image/png" }));
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("digestLifecycleRequest", () => {
  it("matches a lifecycle-shaped payload when extra is omitted", async () => {
    const hashed = await digestLifecycleRequest("finalize_collection", "c1", 3);
    const again = await digestLifecycleRequest("finalize_collection", "c1", 3, undefined);
    expect(hashed).toBe(again);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });
});
