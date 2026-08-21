import { describe, expect, it } from "vitest";
import { isValidVerificationToken, mapPublicVerificationRow } from "@/_pages/collection-documents/api/public/dto";

const token = "a".repeat(64);

describe("public verification DTO", () => {
  it("accepts only a non-enumerable lowercase hexadecimal token", () => {
    expect(isValidVerificationToken(token)).toBe(true);
    expect(isValidVerificationToken("A".repeat(64))).toBe(false);
    expect(isValidVerificationToken("a".repeat(63))).toBe(false);
    expect(isValidVerificationToken(`${token}1`)).toBe(false);
  });

  it("maps only the minimum public fields", () => {
    expect(mapPublicVerificationRow({
      is_authentic: true,
      official_code: "MJT-2026-000123",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "collected",
      organization_name: "MJT Oficina",
      document_version: 1,
      snapshot: { phone: "private" },
      verification_token: token,
    })).toEqual({
      authentic: true,
      officialCode: "MJT-2026-000123",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "collected",
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    });
  });

  it("rejects malformed or incomplete RPC rows", () => {
    expect(mapPublicVerificationRow({ official_code: "MJT-2026-000123" })).toBeNull();
    expect(mapPublicVerificationRow(null)).toBeNull();
  });
});
