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

import { serviceOrderSchema } from "@/_pages/collection-operations/api/queries";
import type { ServiceOrderStatus } from "@/_pages/collection-operations/model/view-models";

const serviceOrderStatusSchema = serviceOrderSchema.shape.status;

const KNOWN_STATUSES = [
  "draft",
  "budgeted",
  "approved",
  "in_service",
  "ready",
  "canceled",
  "rejected",
  "delivered",
] as const satisfies readonly ServiceOrderStatus[];

const sampleUuid = "d3b07384-d113-40a2-a9b3-6c845b410001";

function buildServiceOrder(status: ServiceOrderStatus) {
  return {
    id: sampleUuid,
    organizationId: 1,
    collectionId: "11111111-1111-4111-8111-111111111111",
    administratorId: "22222222-2222-4222-8222-222222222222",
    laborBrl: 450,
    partsBrl: 200,
    dueDays: 5,
    status,
    approvalSignerName: null,
    approvalSignerTaxId: null,
    checkInSignaturePath: null,
    createdAt: "2026-09-06T12:00:00+00:00",
  };
}

describe("ServiceOrderStatus / serviceOrderSchema.status", () => {
  it.each(KNOWN_STATUSES)("accepts known status %s", (status) => {
    expect(serviceOrderStatusSchema.safeParse(status).success).toBe(true);
  });

  it("accepts delivered on the full service order schema", () => {
    const result = serviceOrderSchema.safeParse(buildServiceOrder("delivered"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("delivered");
    }
  });

  it.each(["invoiced", "partial_delivery", "completed", "unknown"])(
    "rejects unknown status %s",
    (status) => {
      expect(serviceOrderStatusSchema.safeParse(status).success).toBe(false);
    },
  );
});
