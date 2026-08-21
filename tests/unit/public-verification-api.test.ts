import { describe, expect, it, vi } from "vitest";

const verificationToken = "a".repeat(64);
const testState = vi.hoisted(() => {
  class TestRateLimitExceededError extends Error {
    readonly retryAfterSeconds: number;
    constructor(retryAfterSeconds: number) {
      super("document_rate_limit_exceeded");
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }

  return {
    verification: {
      authentic: true,
      officialCode: "MJT-2026-000123",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "collected" as const,
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    },
    rateFailure: false,
    TestRateLimitExceededError,
  };
});

vi.mock("@/_pages/collection-documents/index.server", () => ({
  verifyCollectionDocument: async () => testState.verification,
}));

vi.mock("@/_pages/collection-documents/api/delivery/index.server", () => ({
  DocumentRateLimitExceededError: testState.TestRateLimitExceededError,
  DocumentRateLimitUnavailableError: class TestRateLimitUnavailableError extends Error {},
  enforcePublicVerificationRateLimit: async () => {
    if (testState.rateFailure) throw new testState.TestRateLimitExceededError(42);
  },
}));

import { GET } from "../../app/api/public/collections/[verificationToken]/route";

const routeContext = { params: Promise.resolve({ verificationToken }) };

describe("public verification API", () => {
  it("returns only the public DTO with privacy and cache headers", async () => {
    testState.rateFailure = false;
    const response = await GET(new Request(`https://mjt.example/api/public/collections/${verificationToken}`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, noarchive");
    await expect(response.json()).resolves.toEqual(testState.verification);
  });

  it("responds with a safe 429 without exposing a token or private data", async () => {
    testState.rateFailure = true;
    const response = await GET(new Request(`https://mjt.example/api/public/collections/${verificationToken}`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toEqual({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de consultar novamente." } });
    testState.rateFailure = false;
  });

  it("uses the same generic response for an invalid route token", async () => {
    const invalidContext = { params: Promise.resolve({ verificationToken: "not-a-token" }) };
    const response = await GET(new Request("https://mjt.example/api/public/collections/not-a-token"), invalidContext);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message: "Registro não encontrado." } });
  });
});
