import { describe, expect, it } from "vitest";
import { customerDeliveryFormValues } from "@/_pages/collection-operations/model/workshop-rpc-items";

const collectionId = "11111111-1111-4111-8111-111111111111";

describe("customerDeliveryFormValues", () => {
  it("treats missing notes as undefined", () => {
    const formData = new FormData();
    formData.set("expectedVersion", "2");
    formData.set("deliveredItemIds", JSON.stringify([collectionId]));
    formData.set("receiverName", "Ana");
    formData.set("receiverTaxId", "52998224725");
    formData.set("signatureIntentId", "22222222-2222-4222-8222-222222222222");
    expect(customerDeliveryFormValues(collectionId, formData).notes).toBeUndefined();
  });

  it("returns null deliveredItemIds when JSON is malformed", () => {
    const formData = new FormData();
    formData.set("deliveredItemIds", "{not-json");
    expect(customerDeliveryFormValues(collectionId, formData).deliveredItemIds).toBeNull();
  });
});
