import { describe, expect, it } from "vitest";
import { validateLogoFile } from "@/shared/lib/file-validation";

describe("logo validation", () => {
  it("accepts png within the limit", () => expect(validateLogoFile(new File(["png"], "logo.png", { type: "image/png" })).valid).toBe(true));
  it("rejects SVG", () => expect(validateLogoFile(new File(["svg"], "logo.svg", { type: "image/svg+xml" })).valid).toBe(false));
  it("rejects an empty file and an oversized file", () => {
    expect(validateLogoFile(new File([], "empty.png", { type: "image/png" })).valid).toBe(false);
    expect(validateLogoFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })).valid).toBe(false);
  });
});
