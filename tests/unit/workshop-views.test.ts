import { describe, expect, it } from "vitest";
import type { BudgetItem } from "@/_pages/collection-operations/model/view-models";
import {
  checkInItemsFrom,
  deliveryItemsFrom,
  progressItemsFrom,
} from "@/_pages/collection-operations/model/workshop-views";

const itemA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const itemB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const itemC = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const budgetA = "11111111-1111-1111-1111-111111111111";
const budgetB = "22222222-2222-2222-2222-222222222222";

const collectionItems = [
  { id: itemA, description: "Motor elétrico", quantity: 1 },
  { id: itemB, description: "Bomba d'água", quantity: 2 },
  { id: itemC, description: "Sem orçamento", quantity: 1 },
] as const;

const budgetItems: ReadonlyArray<BudgetItem> = [
  {
    id: budgetA,
    collectionItemId: itemA,
    laborCostBrl: 100,
    partsCostBrl: 20,
    estimatedDays: 2,
    status: "em_reparo",
    notes: "rolamento",
  },
  {
    id: budgetB,
    collectionItemId: itemB,
    laborCostBrl: 50,
    partsCostBrl: 0,
    estimatedDays: 1,
    status: "pronto",
    notes: null,
  },
];

describe("progressItemsFrom", () => {
  it("skips delivered items and items without budget status", () => {
    expect(progressItemsFrom(collectionItems, budgetItems, [itemA])).toEqual([
      {
        itemId: itemB,
        itemDescription: "Bomba d'água",
        status: "pronto",
        notes: null,
      },
    ]);
  });
});

describe("deliveryItemsFrom", () => {
  it("joins collection items with budget status and omits missing status", () => {
    expect(deliveryItemsFrom(collectionItems, budgetItems)).toEqual([
      {
        id: itemA,
        description: "Motor elétrico",
        quantity: 1,
        serviceOrderStatus: "em_reparo",
      },
      {
        id: itemB,
        description: "Bomba d'água",
        quantity: 2,
        serviceOrderStatus: "pronto",
      },
    ]);
  });
});

describe("checkInItemsFrom", () => {
  it("keeps id, description and quantity", () => {
    expect(checkInItemsFrom(collectionItems)).toEqual([
      { id: itemA, description: "Motor elétrico", quantity: 1 },
      { id: itemB, description: "Bomba d'água", quantity: 2 },
      { id: itemC, description: "Sem orçamento", quantity: 1 },
    ]);
  });
});
