import { describe, expect, it } from "vitest";
import { toActionFailureCode } from "@/shared/lib/action-failure-code";

describe("toActionFailureCode", () => {
  it("returns known Error.message codes", () => {
    expect(toActionFailureCode(new Error("authentication_required"))).toBe("authentication_required");
    expect(toActionFailureCode(new Error("stale_version"))).toBe("stale_version");
    expect(toActionFailureCode(new Error("idempotency_conflict"))).toBe("idempotency_conflict");
    expect(toActionFailureCode(new Error("invalid_signature_file"))).toBe("invalid_signature_file");
    expect(toActionFailureCode(new Error("collection_incomplete"))).toBe("collection_incomplete");
    expect(toActionFailureCode(new Error("issuer_profile_incomplete"))).toBe("issuer_profile_incomplete");
  });

  it("maps Supabase 40001 to stale_version", () => {
    const error = Object.assign(new Error("could not serialize access due to concurrent update"), {
      code: "40001",
    });
    expect(toActionFailureCode(error)).toBe("stale_version");
    expect(toActionFailureCode({ code: "40001", message: "serialization_failure" })).toBe("stale_version");
  });

  it("maps Supabase 42501 to forbidden", () => {
    expect(toActionFailureCode({ code: "42501", message: "not_authorized" })).toBe("forbidden");
    expect(toActionFailureCode(Object.assign(new Error("permission denied"), { code: "42501" }))).toBe(
      "forbidden",
    );
  });

  it("uses P0001 snake_case message as the machine code", () => {
    expect(toActionFailureCode({ code: "P0001", message: "collection_incomplete" })).toBe(
      "collection_incomplete",
    );
    expect(toActionFailureCode({ code: "P0001", message: "issuer_profile_incomplete" })).toBe(
      "issuer_profile_incomplete",
    );
  });

  it("falls back to operation_failed for unknown or Portuguese text", () => {
    expect(toActionFailureCode(new Error("column users.tax_id does not exist"))).toBe("operation_failed");
    expect(toActionFailureCode(new Error("Sessão expirada. Entre novamente para continuar."))).toBe(
      "operation_failed",
    );
    expect(toActionFailureCode({ code: "P0001", message: "A coleta não atende aos requisitos." })).toBe(
      "operation_failed",
    );
    expect(toActionFailureCode("unexpected")).toBe("operation_failed");
    expect(toActionFailureCode(null)).toBe("operation_failed");
  });

  it("never leaks PII from raw messages into the returned code", () => {
    const code = toActionFailureCode(new Error("cpf=52998224725 column missing"));
    expect(code).toBe("operation_failed");
    expect(code).not.toContain("52998224725");
    expect(JSON.stringify(toActionFailureCode(new Error("email=a@b.com failed")))).not.toContain("a@b.com");
  });
});
