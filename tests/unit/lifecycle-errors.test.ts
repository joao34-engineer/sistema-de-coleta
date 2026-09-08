import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toLifecycleApiError } from "@/_pages/collection-lifecycle/api/lifecycle-errors";

describe("lifecycle API reopen OS fallback (L6)", () => {
  it("maps service_order_reopen_status_unknown to 409 above the generic P0001 fallback", () => {
    expect(toLifecycleApiError({ code: "P0001", message: "service_order_reopen_status_unknown" })).toEqual({
      status: 409,
      code: "service_order_reopen_status_unknown",
      message: "Não foi possível restaurar a ordem de serviço. A coleta permanece cancelada.",
      actorId: null,
    });
  });

  it("keeps unknown P0001 codes on the generic 422 fallback", () => {
    expect(toLifecycleApiError({ code: "P0001", message: "some_unknown_detail" })).toEqual({
      status: 422,
      code: "business_rule_violation",
      message: "A coleta não atende aos requisitos desta operação.",
      actorId: null,
    });
  });
});
