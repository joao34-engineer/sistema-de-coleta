import { describe, expect, it } from "vitest";
import { technicalBudgetSchema } from "@/_pages/collection-operations/model/contracts";

const item = {
  itemId: "11111111-1111-4111-8111-111111111111",
  itemDescription: "Motor",
  laborCostBrl: 10,
  partsCostBrl: 0,
  estimatedDays: 2,
};

describe("technicalBudgetSchema (L4)", () => {
  it("rejects duplicate itemId in the payload", () => {
    const parsed = technicalBudgetSchema.safeParse({
      collectionId: "33333333-3333-4333-8333-333333333333",
      expectedVersion: 1,
      items: [item, { ...item, itemDescription: "Motor duplicado" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts distinct item ids", () => {
    const parsed = technicalBudgetSchema.safeParse({
      collectionId: "33333333-3333-4333-8333-333333333333",
      expectedVersion: 1,
      items: [
        item,
        {
          ...item,
          itemId: "22222222-2222-4222-8222-222222222222",
          itemDescription: "Bomba",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
