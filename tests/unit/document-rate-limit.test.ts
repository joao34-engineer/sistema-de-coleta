import { afterEach, describe, expect, it } from "vitest";
import {
  DocumentRateLimitSecretMissingError,
  documentRateLimitRules,
  getDocumentRateLimitSecret,
  hashDocumentRateLimitSubject,
  peekDocumentRateLimit,
  requestIpRateLimitSubject,
  resetDocumentRateLimit,
  resetLoginRateLimit,
} from "@/shared/lib/rate-limit.server";

const secret = "rate-limit-test-secret-with-at-least-thirty-two-characters";

describe("document rate limiting", () => {
  it("uses the approved fixed windows and limits", () => {
    expect(documentRateLimitRules.verification).toEqual({ scope: "public_verification", limit: 30, windowSeconds: 300 });
    expect(documentRateLimitRules.shareCreate).toEqual({ scope: "document_share_create", limit: 30, windowSeconds: 3600 });
    expect(documentRateLimitRules.emailAdministrator).toEqual({ scope: "document_email_administrator", limit: 10, windowSeconds: 3600 });
    expect(documentRateLimitRules.emailOrganization).toEqual({ scope: "document_email_organization", limit: 50, windowSeconds: 86400 });
    expect(documentRateLimitRules.shareDownload).toEqual({ scope: "document_share_download", limit: 30, windowSeconds: 300 });
    expect(documentRateLimitRules.login).toEqual({ scope: "auth_login", limit: 5, windowSeconds: 900 });
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

  it("keeps login at five attempts per 900 seconds", () => {
    expect(documentRateLimitRules.login).toEqual({ scope: "auth_login", limit: 5, windowSeconds: 900 });
  });

  it("exposes peek and reset helpers without widening consume", () => {
    expect(typeof peekDocumentRateLimit).toBe("function");
    expect(typeof resetDocumentRateLimit).toBe("function");
    expect(typeof resetLoginRateLimit).toBe("function");
  });
});

describe("document rate-limit secret", () => {
  const originalSecret = process.env["DOCUMENT_RATE_LIMIT_SECRET"];

  afterEach(() => {
    if (originalSecret === undefined) delete process.env["DOCUMENT_RATE_LIMIT_SECRET"];
    else process.env["DOCUMENT_RATE_LIMIT_SECRET"] = originalSecret;
  });

  it("throws DocumentRateLimitSecretMissingError when the secret is absent", () => {
    delete process.env["DOCUMENT_RATE_LIMIT_SECRET"];
    expect(() => getDocumentRateLimitSecret()).toThrow(DocumentRateLimitSecretMissingError);
  });

  it("throws DocumentRateLimitSecretMissingError when the secret is shorter than 32 characters", () => {
    process.env["DOCUMENT_RATE_LIMIT_SECRET"] = "too-short-to-be-a-hmac-key";
    expect(() => getDocumentRateLimitSecret()).toThrow(DocumentRateLimitSecretMissingError);
    expect(() => getDocumentRateLimitSecret()).toThrow(/document_rate_limit_unavailable/);
  });

  it("returns the secret when it meets the minimum length", () => {
    process.env["DOCUMENT_RATE_LIMIT_SECRET"] = secret;
    expect(getDocumentRateLimitSecret()).toBe(secret);
  });
});
