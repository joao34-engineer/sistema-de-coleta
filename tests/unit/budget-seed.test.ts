import { describe, expect, it } from "vitest";
import { seedBudgetItemsFromCollection } from "@/_pages/collection-operations/model/budget-seed";
import type { BudgetItem } from "@/_pages/collection-operations/model/view-models";

const itemA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const itemB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const soItemA = "11111111-1111-1111-1111-111111111111";

describe("seedBudgetItemsFromCollection", () => {
  it("seeds N lines with 0/0/1 when budget is empty and collection has items", () => {
    const result = seedBudgetItemsFromCollection({
      collectionItems: [
        { id: itemA, description: "Motor elétrico" },
        { id: itemB, description: "Bomba d'água" },
      ],
      budgetItems: [],
    });

    expect(result).toEqual([
      {
        id: itemA,
        collectionItemId: itemA,
        itemDescription: "Motor elétrico",
        laborCostBrl: 0,
        partsCostBrl: 0,
        estimatedDays: 1,
        status: null,
        notes: null,
      },
      {
        id: itemB,
        collectionItemId: itemB,
        itemDescription: "Bomba d'água",
        laborCostBrl: 0,
        partsCostBrl: 0,
        estimatedDays: 1,
        status: null,
        notes: null,
      },
    ]);
  });

  it("prefers persisted budget rows and enriches description from collection items", () => {
    const persisted: BudgetItem = {
      id: soItemA,
      collectionItemId: itemA,
      laborCostBrl: 120.5,
      partsCostBrl: 40,
      estimatedDays: 3,
      status: "em_reparo",
      notes: "trocar rolamento",
    };

    const result = seedBudgetItemsFromCollection({
      collectionItems: [
        { id: itemA, description: "Motor elétrico" },
        { id: itemB, description: "Não usado no seed" },
      ],
      budgetItems: [persisted],
    });

    expect(result).toEqual([
      {
        ...persisted,
        itemDescription: "Motor elétrico",
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("uses fallback description when persisted item has no matching collection item", () => {
    const persisted: BudgetItem = {
      id: soItemA,
      collectionItemId: itemA,
      laborCostBrl: 10,
      partsCostBrl: 0,
      estimatedDays: 1,
      status: null,
      notes: null,
    };

    const result = seedBudgetItemsFromCollection({
      collectionItems: [],
      budgetItems: [persisted],
    });

    expect(result[0]?.itemDescription).toBe("Item da coleta");
  });

  it("returns empty array when both budget and collection items are empty", () => {
    expect(
      seedBudgetItemsFromCollection({
        collectionItems: [],
        budgetItems: [],
      }),
    ).toEqual([]);
  });

  it("omits missing check-in items from the empty-budget seed", () => {
    const result = seedBudgetItemsFromCollection({
      collectionItems: [
        { id: itemA, description: "Motor elétrico" },
        { id: itemB, description: "Bomba d'água" },
      ],
      budgetItems: [],
      missingItemIds: [itemB],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.collectionItemId).toBe(itemA);
  });
});
