import { describe, expect, it } from "vitest";
import { presentFinalizeSync } from "@/_pages/collection-drafts/model/present-finalize-sync";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";

const leftover = {
  id: "22222222-2222-4222-8222-222222222222",
} as OfflineDraftRecord;

describe("presentFinalizeSync", () => {
  it("shows queued local success when offline", () => {
    expect(presentFinalizeSync({ wasOnline: false, leftover, serverRowExists: false })).toBe("queued_local");
    expect(presentFinalizeSync({ wasOnline: false, leftover: null, serverRowExists: false })).toBe("queued_local");
  });

  it("opens the collection only when leftover is gone and the server row exists", () => {
    expect(presentFinalizeSync({ wasOnline: true, leftover: null, serverRowExists: true })).toBe("open_collection");
  });

  it("does not open the hub when leftover is gone but the server row is missing", () => {
    expect(presentFinalizeSync({ wasOnline: true, leftover: null, serverRowExists: false })).toBe("queued_local");
  });

  it("shows an error when online drain leaves a local draft", () => {
    expect(presentFinalizeSync({ wasOnline: true, leftover, serverRowExists: false })).toBe("online_failed");
  });
});
