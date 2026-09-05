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

  it("accepts workshop issued statuses such as in_workshop", () => {
    expect(mapPublicVerificationRow({
      is_authentic: true,
      official_code: "MJT-2026-000124",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "in_workshop",
      organization_name: "MJT Oficina",
      document_version: 1,
    })).toEqual({
      authentic: true,
      officialCode: "MJT-2026-000124",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "in_workshop",
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    });
  });

  it("rejects malformed or incomplete RPC rows", () => {
    expect(mapPublicVerificationRow({ official_code: "MJT-2026-000123" })).toBeNull();
    expect(mapPublicVerificationRow(null)).toBeNull();
  });

  it("maps in_service workshop status as authentic public data", () => {
    expect(mapPublicVerificationRow({
      is_authentic: true,
      official_code: "MJT-2026-000125",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "in_service",
      organization_name: "MJT Oficina",
      document_version: 1,
    })).toEqual({
      authentic: true,
      officialCode: "MJT-2026-000125",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "in_service",
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    });
  });

  it("maps canceled status without dropping the public record", () => {
    expect(mapPublicVerificationRow({
      is_authentic: false,
      official_code: "MJT-2026-000126",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "canceled",
      organization_name: "MJT Oficina",
      document_version: 1,
    })).toEqual({
      authentic: false,
      officialCode: "MJT-2026-000126",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "canceled",
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    });
  });

  it("rejects draft status because it is not an issued public status", () => {
    expect(mapPublicVerificationRow({
      is_authentic: true,
      official_code: "MJT-2026-000127",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "draft",
      organization_name: "MJT Oficina",
      document_version: 1,
    })).toBeNull();
  });

  it("rejects unknown collection statuses", () => {
    expect(mapPublicVerificationRow({
      is_authentic: true,
      official_code: "MJT-2026-000128",
      issued_at: "2026-08-20T15:30:00.000Z",
      collection_status: "mystery_status",
      organization_name: "MJT Oficina",
      document_version: 1,
    })).toBeNull();
  });
});

