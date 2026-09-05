import { describe, expect, it } from "vitest";
import { toActionFailureCode, toFinalizeActionFailureCode } from "@/shared/lib/action-failure-code";

describe("toFinalizeActionFailureCode", () => {
  it("remaps unknown SQL errors to finalize_failed", () => {
    expect(
      toFinalizeActionFailureCode(new Error("column reference document_id is ambiguous")),
    ).toBe("finalize_failed");
  });

  it("preserves known finalize codes such as stale_version", () => {
    expect(toFinalizeActionFailureCode(new Error("stale_version"))).toBe("stale_version");
  });
});

describe("toActionFailureCode", () => {
  it("still returns operation_failed for unknown SQL errors", () => {
    expect(toActionFailureCode(new Error("column reference document_id is ambiguous"))).toBe(
      "operation_failed",
    );
  });
});
