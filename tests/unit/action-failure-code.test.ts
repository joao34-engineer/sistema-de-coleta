import { beforeEach, describe, expect, it, vi } from "vitest";
import { toActionFailureCode, toFinalizeActionFailureCode } from "@/shared/lib/action-failure-code";

vi.mock("@/_pages/collection-drafts/api/drafts.server", () => ({
  addItem: vi.fn(),
  getDraft: vi.fn(),
  patchDraft: vi.fn(),
  patchItem: vi.fn(),
  removeItem: vi.fn(),
}));

import { addItem } from "@/_pages/collection-drafts/api/drafts.server";
import { addItemToDraftAction } from "@/_pages/collection-drafts/api/actions";
import { AuthenticationRequiredError } from "@/shared/auth/require-admin";

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
  it("preserves stale_version machine code", () => {
    expect(toActionFailureCode(new Error("stale_version"))).toBe("stale_version");
  });

  it("maps Supabase serialization failure (40001) to stale_version", () => {
    const error = new Error("could not serialize access");
    Object.assign(error, { code: "40001" });
    expect(toActionFailureCode(error)).toBe("stale_version");
  });

  it("preserves invalid_signer_tax_id", () => {
    expect(toActionFailureCode(new Error("invalid_signer_tax_id"))).toBe("invalid_signer_tax_id");
  });

  it("preserves authentication_required", () => {
    expect(toActionFailureCode(new Error("authentication_required"))).toBe("authentication_required");
  });

  it("returns operation_failed for unknown SQL errors", () => {
    expect(toActionFailureCode(new Error("column reference document_id is ambiguous"))).toBe(
      "operation_failed",
    );
  });
});

describe("addItemToDraftAction failure codes", () => {
  beforeEach(() => {
    vi.mocked(addItem).mockReset();
  });

  it("maps AuthenticationRequiredError to authentication_required", async () => {
    vi.mocked(addItem).mockRejectedValue(new AuthenticationRequiredError());

    const result = await addItemToDraftAction({
      collectionId: "22222222-2222-4222-8222-222222222222",
      expectedVersion: 1,
      description: "Motor",
      quantity: 1,
    });

    expect(result).toEqual({ ok: false, error: "authentication_required" });
  });
});
