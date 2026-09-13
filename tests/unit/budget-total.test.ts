import { describe, expect, it } from "vitest";
import { budgetTotalOf } from "@/_pages/collection-operations/model/budget-seed";

describe("budgetTotalOf", () => {
  it("returns 0 for an empty list", () => {
    expect(budgetTotalOf([])).toBe(0);
  });

  it("sums labor and parts across items", () => {
    expect(
      budgetTotalOf([
        { laborCostBrl: 120.5, partsCostBrl: 40 },
        { laborCostBrl: 10, partsCostBrl: 0 },
      ]),
    ).toBe(170.5);
  });
});
