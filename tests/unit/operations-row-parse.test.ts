import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  OperationsRowParseError,
  parseOperationsRows,
} from "@/_pages/collection-operations/model/operations-row-parse";

const uuid = "11111111-1111-4111-8111-111111111111";

const budgetItemSchema = z.object({
  id: z.uuid(),
  collectionItemId: z.uuid(),
  laborCostBrl: z.number(),
  partsCostBrl: z.number(),
  estimatedDays: z.number().int().positive(),
  status: z.enum(["em_reparo", "pronto"]).nullable(),
  notes: z.string().nullable(),
});

const validRow = {
  id: uuid,
  collectionItemId: "22222222-2222-4222-8222-222222222222",
  laborCostBrl: 10,
  partsCostBrl: 5,
  estimatedDays: 2,
  status: "pronto" as const,
  notes: null,
};

describe("parseOperationsRows", () => {
  it("returns an empty array for null payload", () => {
    expect(parseOperationsRows(budgetItemSchema, null)).toEqual([]);
  });

  it("keeps valid rows", () => {
    expect(parseOperationsRows(budgetItemSchema, [validRow])).toEqual([validRow]);
  });

  it("skips a row whose collectionItemId is null without dropping siblings", () => {
    const orphan = { ...validRow, id: "33333333-3333-4333-8333-333333333333", collectionItemId: null };
    expect(parseOperationsRows(budgetItemSchema, [orphan, validRow])).toEqual([validRow]);
  });

  it("throws when a row with an id fails Zod (estimatedDays)", () => {
    const invalid = { ...validRow, estimatedDays: 0 };
    expect(() => parseOperationsRows(budgetItemSchema, [validRow, invalid])).toThrow(OperationsRowParseError);
  });

  it("throws when the payload is not an array", () => {
    expect(() => parseOperationsRows(budgetItemSchema, { id: uuid })).toThrow(OperationsRowParseError);
  });
});
