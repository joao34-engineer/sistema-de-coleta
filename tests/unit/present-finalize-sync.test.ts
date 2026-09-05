import { describe, expect, it } from "vitest";
import { presentFinalizeSync } from "@/_pages/collection-drafts/model/present-finalize-sync";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";

const leftover = {
  id: "22222222-2222-4222-8222-222222222222",
} as OfflineDraftRecord;

describe("presentFinalizeSync", () => {
  it("shows queued local success when offline", () => {
    expect(presentFinalizeSync({ wasOnline: false, leftover })).toBe("queued_local");
    expect(presentFinalizeSync({ wasOnline: false, leftover: null })).toBe("queued_local");
  });

  it("opens the collection when online drain purged the draft", () => {
    expect(presentFinalizeSync({ wasOnline: true, leftover: null })).toBe("open_collection");
  });

  it("shows an error when online drain leaves a local draft", () => {
    expect(presentFinalizeSync({ wasOnline: true, leftover })).toBe("online_failed");
  });
});
