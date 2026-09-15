import { describe, expect, it } from "vitest";
import { listRowCustomerLine } from "@/_pages/collection-lifecycle/model/list-row-customer-line";

describe("listRowCustomerLine", () => {
  it("joins customer name with plural item count", () => {
    expect(listRowCustomerLine("Maria Silva", 3)).toBe("Maria Silva · 3 itens");
  });

  it("uses singular item for a count of one", () => {
    expect(listRowCustomerLine("Maria Silva", 1)).toBe("Maria Silva · 1 item");
  });

  it("falls back when the customer name is missing", () => {
    expect(listRowCustomerLine(null, 0)).toBe("Cliente não informado · 0 itens");
  });
});
