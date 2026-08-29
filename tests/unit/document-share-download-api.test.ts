import { describe, expect, it, vi } from "vitest";

const shareToken = "b".repeat(64);
const testState = vi.hoisted(() => {
  class TestRateLimitExceededError extends Error {
    readonly retryAfterSeconds: number;
    constructor(retryAfterSeconds: number) {
      super("document_rate_limit_exceeded");
      this.name = "DocumentRateLimitExceededError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  class TestRateLimitUnavailableError extends Error {
    constructor() {
      super("document_rate_limit_unavailable");
      this.name = "DocumentRateLimitUnavailableError";
    }
  }

  return {
    rateMode: "ok" as "ok" | "exceeded" | "unavailable",
    TestRateLimitExceededError,
    TestRateLimitUnavailableError,
  };
});

vi.mock("@/_pages/collection-documents/api/delivery/index.server", () => ({
  consumeDocumentShare: async () => ({ valid: false, code: "not_found" }),
  createConsumedShareDownload: async () => null,
}));

vi.mock("@/shared/lib/rate-limit.server", () => ({
  DocumentRateLimitExceededError: testState.TestRateLimitExceededError,
  DocumentRateLimitUnavailableError: testState.TestRateLimitUnavailableError,
  enforceShareDownloadRateLimit: async () => {
    if (testState.rateMode === "exceeded") throw new testState.TestRateLimitExceededError(17);
    if (testState.rateMode === "unavailable") throw new testState.TestRateLimitUnavailableError();
  },
}));

import { GET } from "../../app/(public)/d/[shareToken]/download/route";

const routeContext = { params: Promise.resolve({ shareToken }) };

describe("document share download API", () => {
  it("responds with a safe 429 without exposing the token", async () => {
    testState.rateMode = "exceeded";
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    const body = await response.json();
    expect(body).toEqual({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." } });
    expect(JSON.stringify(body)).not.toContain(shareToken);
    testState.rateMode = "ok";
  });

  it("responds with a safe 503 when the limiter is unavailable", async () => {
    testState.rateMode = "unavailable";
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } });
    testState.rateMode = "ok";
  });

  it("uses the same generic 404 for an invalid token shape", async () => {
    const response = await GET(new Request("https://mjt.example/d/not-a-token/download"), { params: Promise.resolve({ shareToken: "not-a-token" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message: "Link indisponível." } });
  });
});
