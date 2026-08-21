import { describe, expect, it } from "vitest";
import {
  documentRateLimitRules,
  hashDocumentRateLimitSubject,
  requestIpRateLimitSubject,
} from "@/_pages/collection-documents/api/delivery/rate-limit.server";

const secret = "rate-limit-test-secret-with-at-least-thirty-two-characters";

describe("document rate limiting", () => {
  it("uses the approved fixed windows and limits", () => {
    expect(documentRateLimitRules.verification).toEqual({ scope: "public_verification", limit: 30, windowSeconds: 300 });
    expect(documentRateLimitRules.shareCreate).toEqual({ scope: "document_share_create", limit: 30, windowSeconds: 3600 });
    expect(documentRateLimitRules.emailAdministrator).toEqual({ scope: "document_email_administrator", limit: 10, windowSeconds: 3600 });
    expect(documentRateLimitRules.emailOrganization).toEqual({ scope: "document_email_organization", limit: 50, windowSeconds: 86400 });
  });

  it("pseudonymizes the client address and never returns the raw value to the backend", () => {
    const subject = requestIpRateLimitSubject(new Request("https://mjt.example/verificar/token", { headers: { "x-forwarded-for": "198.51.100.19, 10.0.0.1" } }));
    const hashed = hashDocumentRateLimitSubject(subject, secret);

    expect(subject).toBe("ip:198.51.100.19");
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain("198.51.100.19");
  });

  it("uses one opaque bucket when the proxy address is missing or invalid", () => {
    expect(requestIpRateLimitSubject(new Request("https://mjt.example/verificar/token", { headers: { "x-forwarded-for": "not-an-ip" } }))).toBe("ip:unavailable");
  });
});
