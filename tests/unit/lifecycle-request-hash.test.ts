import { describe, expect, it } from "vitest";
import { digestLifecycleRequest } from "@/_pages/collection-operations/model/lifecycle-request-hash";

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("digestLifecycleRequest", () => {
  it("stays identical when extra item ids are omitted", async () => {
    const withoutExtra = await digestLifecycleRequest("cancel_or_reopen_collection", "c1", 2, "motivo");
    const alsoWithoutExtra = await digestLifecycleRequest("cancel_or_reopen_collection", "c1", 2, "motivo");
    expect(withoutExtra).toBe(alsoWithoutExtra);
  });

  it("changes when the delivered item id set changes and is order-independent", async () => {
    const sorted = await digestLifecycleRequest("deliver_to_customer", "c1", 1, undefined, {
      deliveredItemIds: [idA, idB],
    });
    const reversed = await digestLifecycleRequest("deliver_to_customer", "c1", 1, undefined, {
      deliveredItemIds: [idB, idA],
    });
    const single = await digestLifecycleRequest("deliver_to_customer", "c1", 1, undefined, {
      deliveredItemIds: [idA],
    });
    const omitted = await digestLifecycleRequest("deliver_to_customer", "c1", 1);

    expect(sorted).toBe(reversed);
    expect(sorted).not.toBe(single);
    expect(sorted).not.toBe(omitted);
  });
});
