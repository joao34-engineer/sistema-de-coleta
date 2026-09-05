import { describe, expect, it } from "vitest";
import { hasRequiredCollectionLocation } from "@/_pages/collection-drafts/model/has-required-collection-location";

describe("hasRequiredCollectionLocation", () => {
  it("accepts a non-empty trimmed location", () => {
    expect(hasRequiredCollectionLocation("Rua das Oficinas, 10")).toBe(true);
    expect(hasRequiredCollectionLocation("  pátio  ")).toBe(true);
  });

  it("rejects null, undefined, empty and whitespace-only values", () => {
    expect(hasRequiredCollectionLocation(null)).toBe(false);
    expect(hasRequiredCollectionLocation(undefined)).toBe(false);
    expect(hasRequiredCollectionLocation("")).toBe(false);
    expect(hasRequiredCollectionLocation("   ")).toBe(false);
  });
});
