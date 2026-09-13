import { describe, expect, it } from "vitest";
import { classifyCommandError } from "@/shared/lib/command-error";

describe("classifyCommandError", () => {
  it("maps auth error names without leaking internals", () => {
    const auth = classifyCommandError({ name: "AuthenticationRequiredError", message: "authentication_required" });
    expect(auth).toEqual({
      code: "authentication_required",
      status: 401,
      httpMessage: "Autenticação obrigatória.",
      actionMessage: "Sessão expirada. Entre novamente para continuar.",
    });
    expect(auth.httpMessage).not.toBe(auth.actionMessage);

    const denied = classifyCommandError({ name: "AdministratorAccessDeniedError" });
    expect(denied.code).toBe("administrator_access_denied");
    expect(denied.status).toBe(403);
  });

  it("keeps distinct HTTP and Action copy for stale_version", () => {
    const mapped = classifyCommandError({ code: "40001" });
    expect(mapped.code).toBe("stale_version");
    expect(mapped.status).toBe(409);
    expect(mapped.httpMessage).toBe("A coleta foi atualizada por outra operação.");
    expect(mapped.actionMessage).toBe(
      "A coleta foi atualizada por outra operação. Recarregue a página e revise os dados.",
    );
  });

  it("remaps RPC aliases to public codes", () => {
    expect(classifyCommandError({ code: "P0001", message: "collection_not_collected" })).toMatchObject({
      code: "workshop_checkin_not_collected",
      status: 409,
    });
    expect(classifyCommandError({ code: "P0001", message: "collection_not_ready" })).toMatchObject({
      code: "invoice_not_ready",
      status: 409,
    });
    expect(classifyCommandError({ code: "P0001", message: "signature_intent_not_committed" })).toMatchObject({
      code: "delivery_intent_required",
      status: 409,
    });
    expect(classifyCommandError({ code: "P0001", message: "customer_snapshot_immutable" })).toMatchObject({
      code: "immutable_record",
      status: 409,
    });
  });

  it("maps SQL codes without surfacing raw database text", () => {
    expect(classifyCommandError({ code: "23505", message: "duplicate key value violates unique constraint" })).toEqual({
      code: "conflict",
      status: 409,
      httpMessage: "A operação conflita com um registro existente.",
      actionMessage: "A operação conflita com um registro existente.",
    });
    expect(classifyCommandError({ code: "42501", message: "permission denied for table collections" })).toMatchObject({
      code: "administrator_access_denied",
      status: 403,
    });
    const leaked = classifyCommandError(new Error("column users.tax_id does not exist"));
    expect(leaked.code).toBe("unexpected_error");
    expect(leaked.actionMessage).not.toContain("tax_id");
    expect(leaked.httpMessage).not.toContain("tax_id");
  });

  it("falls back to business_rule_violation for unknown P0001 codes", () => {
    expect(classifyCommandError({ code: "P0001", message: "some_unknown_detail" })).toEqual({
      code: "business_rule_violation",
      status: 422,
      httpMessage: "A coleta não atende aos requisitos desta operação.",
      actionMessage: "A coleta não atende aos requisitos desta operação.",
    });
  });
});
