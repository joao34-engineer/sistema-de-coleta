/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock("@/_pages/collection-operations/api/operations-supabase", () => ({
  createOperationsSupabaseClient: vi.fn(),
}));

import {
  budgetItemColumns,
  deliveryTermColumns,
  deliveryTermItemColumns,
  invoiceReferenceColumns,
  serviceOrderColumns,
} from "@/_pages/collection-operations/api/queries";

const workshopSelects = [
  serviceOrderColumns,
  budgetItemColumns,
  deliveryTermColumns,
  deliveryTermItemColumns,
  invoiceReferenceColumns,
] as const;

describe("workshop query columns", () => {
  it("lists explicit columns instead of select *", () => {
    for (const columns of workshopSelects) {
      expect(columns).not.toContain("*");
      expect(columns.length).toBeGreaterThan(0);
    }
  });

  it("keeps the Zod-aligned service order fields", () => {
    expect(serviceOrderColumns).toContain("due_days");
    expect(serviceOrderColumns).toContain("check_in_signature_path");
    expect(serviceOrderColumns).not.toContain("updated_at");
    expect(serviceOrderColumns).not.toContain("previous_status_before_cancellation");
  });
});
