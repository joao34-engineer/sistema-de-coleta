import { describe, expect, it } from "vitest";
import { canReloadFromSnapshot } from "@/_pages/collection-drafts/model/offline-snapshot";

describe("canReloadFromSnapshot", () => {
  it("allows reload when nothing is pending or draining", () => {
    expect(canReloadFromSnapshot({ pendingCount: 0, failedCount: 0, draining: false })).toBe(true);
  });

  it("blocks reload while a drain is in flight", () => {
    expect(canReloadFromSnapshot({ pendingCount: 0, failedCount: 0, draining: true })).toBe(false);
  });

  it("blocks reload while collections are pending", () => {
    expect(canReloadFromSnapshot({ pendingCount: 2, failedCount: 1, draining: false })).toBe(false);
  });
});
