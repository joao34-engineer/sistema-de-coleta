import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toOperationsApiError } from "@/_pages/collection-operations/api/operations-errors";

describe("operations API delivery item codes (5.5)", () => {
  it("maps duplicate and already-delivered codes to 409 with Portuguese copy", () => {
    expect(toOperationsApiError({ code: "P0001", message: "duplicate_delivery_item" })).toMatchObject({
      status: 409,
      code: "duplicate_delivery_item",
      message: "O mesmo item foi informado mais de uma vez na entrega.",
    });
    expect(toOperationsApiError({ code: "P0001", message: "item_already_delivered" })).toMatchObject({
      status: 409,
      code: "item_already_delivered",
      message: "Um ou mais itens já foram entregues em um termo anterior.",
    });
  });

  it("keeps PR 9 check-in codes on 422", () => {
    expect(toOperationsApiError({ code: "P0001", message: "duplicate_workshop_item" })).toMatchObject({
      status: 422,
      code: "duplicate_workshop_item",
    });
    expect(toOperationsApiError({ code: "P0001", message: "workshop_checkin_items_incomplete" })).toMatchObject({
      status: 422,
      code: "workshop_checkin_items_incomplete",
    });
  });
});
