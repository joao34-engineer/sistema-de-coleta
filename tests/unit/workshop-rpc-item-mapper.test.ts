import { describe, expect, it } from "vitest";
import {
  parseJsonFormField,
  toServiceProgressRpcItems,
  toTechnicalBudgetRpcItems,
  toWorkshopCheckInRpcItems,
} from "@/_pages/collection-operations/model/workshop-rpc-items";

const itemId = "11111111-1111-1111-1111-111111111111";

describe("workshop RPC item mappers", () => {
  it("maps workshop check-in items to snake_case RPC JSON", () => {
    expect(
      toWorkshopCheckInRpcItems([
        {
          itemId,
          itemDescription: "Motor",
          quantityObserved: 2,
          conditionObserved: "ok",
          divergenceNotes: "faltou 1",
        },
      ]),
    ).toEqual([
      {
        item_id: itemId,
        item_description: "Motor",
        quantity_observed: 2,
        condition_observed: "ok",
        divergence_notes: "faltou 1",
      },
    ]);
  });

  it("maps technical budget items to snake_case RPC JSON", () => {
    expect(
      toTechnicalBudgetRpcItems([
        {
          itemId,
          itemDescription: "Motor",
          laborCostBrl: 10.5,
          partsCostBrl: 3,
          estimatedDays: 2,
          notes: null,
        },
      ]),
    ).toEqual([
      {
        item_id: itemId,
        item_description: "Motor",
        labor_cost_brl: 10.5,
        parts_cost_brl: 3,
        estimated_days: 2,
        notes: null,
      },
    ]);
  });

  it("maps service progress items to snake_case RPC JSON", () => {
    expect(
      toServiceProgressRpcItems([
        {
          itemId,
          itemDescription: "Motor",
          status: "pronto",
          notes: "ok",
        },
      ]),
    ).toEqual([
      {
        item_id: itemId,
        status: "pronto",
        notes: "ok",
      },
    ]);
  });
});

describe("parseJsonFormField", () => {
  it("parses a valid JSON string", () => {
    expect(parseJsonFormField('[{"itemId":"x"}]')).toEqual([{ itemId: "x" }]);
    expect(parseJsonFormField('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for empty or whitespace input", () => {
    expect(parseJsonFormField("")).toBeNull();
    expect(parseJsonFormField("   ")).toBeNull();
    expect(parseJsonFormField(null)).toBeNull();
    expect(parseJsonFormField(undefined)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseJsonFormField("{")).toBeNull();
    expect(parseJsonFormField("not-json")).toBeNull();
  });
});
