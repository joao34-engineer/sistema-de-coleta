import { describe, expect, it, vi } from "vitest";

const shareToken = "b".repeat(64);
const fakeShareId = "11111111-1111-4111-8111-111111111111";
const fakeDocumentId = "22222222-2222-4222-8222-222222222222";
const fakeCollectionId = "33333333-3333-4333-8333-333333333333";
const fakeIssuedAt = "2026-01-15T12:00:00+00:00";

const validInspectShare = {
  valid: true as const,
  shareId: fakeShareId,
  shareType: "pdf" as const,
  documentId: fakeDocumentId,
  organizationId: 1,
  collectionId: fakeCollectionId,
  documentVersion: 1,
  issuedAt: fakeIssuedAt,
  maxDownloads: 20,
  downloadCount: 0,
};

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
    inspectResult: { valid: false, code: "share_not_found" } as Record<string, unknown>,
    signedUrl: null as string | null,
    consumeResult: { valid: false, code: "share_unavailable" } as Record<string, unknown>,
    inspectCalls: 0,
    consumeCalls: 0,
    createDownloadCalls: 0,
    TestRateLimitExceededError,
    TestRateLimitUnavailableError,
  };
});

vi.mock("@/_pages/collection-documents/api/delivery/index.server", () => ({
  inspectDocumentShare: async () => {
    testState.inspectCalls += 1;
    return testState.inspectResult;
  },
  createConsumedShareDownload: async () => {
    testState.createDownloadCalls += 1;
    return testState.signedUrl;
  },
  consumeDocumentShare: async () => {
    testState.consumeCalls += 1;
    return testState.consumeResult;
  },
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

function resetDeliveryState() {
  testState.inspectResult = { valid: false, code: "share_not_found" };
  testState.signedUrl = null;
  testState.consumeResult = { valid: false, code: "share_unavailable" };
  testState.inspectCalls = 0;
  testState.consumeCalls = 0;
  testState.createDownloadCalls = 0;
  testState.rateMode = "ok";
}

describe("document share download API", () => {
  it("responds with a safe 429 without exposing the token", async () => {
    resetDeliveryState();
    testState.rateMode = "exceeded";
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    const body = await response.json();
    expect(body).toEqual({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." } });
    expect(JSON.stringify(body)).not.toContain(shareToken);
  });

  it("responds with HTML 429 for document navigation without exposing the token", async () => {
    resetDeliveryState();
    testState.rateMode = "exceeded";
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`, {
      headers: { "x-forwarded-for": "198.51.100.19", "Sec-Fetch-Dest": "document" },
    }), routeContext);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Aguarde antes de tentar novamente.");
    expect(body).not.toContain(shareToken);
  });

  it("responds with a safe 503 when the limiter is unavailable", async () => {
    resetDeliveryState();
    testState.rateMode = "unavailable";
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`, { headers: { "x-forwarded-for": "198.51.100.19" } }), routeContext);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } });
  });

  it("uses the same generic 404 for an invalid token shape", async () => {
    resetDeliveryState();
    const response = await GET(new Request("https://mjt.example/d/not-a-token/download"), { params: Promise.resolve({ shareToken: "not-a-token" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message: "Link indisponível." } });
  });

  it("does not consume quota when signed URL mint fails", async () => {
    resetDeliveryState();
    testState.inspectResult = validInspectShare;
    testState.signedUrl = null;
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`), routeContext);
    expect(response.status).toBe(404);
    expect(testState.inspectCalls).toBe(1);
    expect(testState.createDownloadCalls).toBe(1);
    expect(testState.consumeCalls).toBe(0);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "not_found", message: "Link indisponível." } });
    expect(JSON.stringify(body)).not.toContain(shareToken);
    expect(JSON.stringify(body)).not.toContain("storage");
  });

  it("redirects on happy path after inspect, mint, and consume", async () => {
    resetDeliveryState();
    testState.inspectResult = validInspectShare;
    testState.signedUrl = "https://signed.example/pdf";
    testState.consumeResult = { ...validInspectShare, downloadCount: 1 };
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`), routeContext);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://signed.example/pdf");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(testState.inspectCalls).toBe(1);
    expect(testState.createDownloadCalls).toBe(1);
    expect(testState.consumeCalls).toBe(1);
  });

  it("returns 404 without redirect when consume loses the last slot", async () => {
    resetDeliveryState();
    testState.inspectResult = validInspectShare;
    testState.signedUrl = "https://signed.example/pdf";
    testState.consumeResult = { valid: false, code: "share_unavailable" };
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`), routeContext);
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
    expect(testState.consumeCalls).toBe(1);
    await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message: "Link indisponível." } });
  });

  it("returns 404 before consume for verification share type", async () => {
    resetDeliveryState();
    testState.inspectResult = { ...validInspectShare, shareType: "verification" };
    const response = await GET(new Request(`https://mjt.example/d/${shareToken}/download`), routeContext);
    expect(response.status).toBe(404);
    expect(testState.createDownloadCalls).toBe(0);
    expect(testState.consumeCalls).toBe(0);
    await expect(response.json()).resolves.toEqual({ error: { code: "not_found", message: "Link indisponível." } });
  });
});
