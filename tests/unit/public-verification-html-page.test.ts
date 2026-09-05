import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const verificationToken = "a".repeat(64);

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
    verification: {
      authentic: true,
      officialCode: "MJT-2026-000123",
      issuedAt: "2026-08-20T15:30:00.000Z",
      status: "collected" as const,
      organization: { name: "MJT Oficina" },
      documentVersion: 1,
    },
    TestRateLimitExceededError,
    TestRateLimitUnavailableError,
  };
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.19" }),
}));

vi.mock("@/shared/lib/rate-limit.server", () => ({
  DocumentRateLimitExceededError: testState.TestRateLimitExceededError,
  DocumentRateLimitUnavailableError: testState.TestRateLimitUnavailableError,
  enforcePublicVerificationRateLimit: async () => {
    if (testState.rateMode === "exceeded") throw new testState.TestRateLimitExceededError(42);
    if (testState.rateMode === "unavailable") throw new testState.TestRateLimitUnavailableError();
  },
}));

vi.mock("@/_pages/collection-documents/index.server", async () => {
  const React = await import("react");
  const { PublicVerificationPage } = await import("@/_pages/collection-documents/ui/public-verification-page");
  return {
    PublicVerificationRoute: async () => React.createElement(PublicVerificationPage, { verification: testState.verification }),
  };
});

import PublicVerificationHtmlPage from "../../app/(public)/verificar/[verificationToken]/page";

describe("public verification HTML page", () => {
  it("renders a wait card when rate limit is exceeded without throwing", async () => {
    testState.rateMode = "exceeded";
    const element = await PublicVerificationHtmlPage({ params: Promise.resolve({ verificationToken }) });
    const html = renderToString(element);

    expect(html).toContain("Aguarde antes de consultar novamente.");
    expect(html).not.toContain("Algo deu errado");
    expect(html).not.toContain(verificationToken);
    testState.rateMode = "ok";
  });

  it("renders an unavailable card when the limiter fails closed", async () => {
    testState.rateMode = "unavailable";
    const element = await PublicVerificationHtmlPage({ params: Promise.resolve({ verificationToken }) });
    const html = renderToString(element);

    expect(html).toContain("Consulta temporariamente indisponível.");
    expect(html).not.toContain("Algo deu errado");
    expect(html).not.toContain(verificationToken);
    testState.rateMode = "ok";
  });

  it("shows not found for an invalid token without consuming quota", async () => {
    testState.rateMode = "exceeded";
    const element = await PublicVerificationHtmlPage({ params: Promise.resolve({ verificationToken: "not-a-token" }) });
    const html = renderToString(element);

    expect(html).toContain("Registro não encontrado");
    expect(html).not.toContain("Aguarde antes de consultar novamente.");
    expect(html).not.toContain("Consulta temporariamente indisponível.");
    testState.rateMode = "ok";
  });

  it("reaches the authentic verification UI when the limiter allows the request", async () => {
    testState.rateMode = "ok";
    const element = await PublicVerificationHtmlPage({ params: Promise.resolve({ verificationToken }) });
    const html = renderToString(element);

    expect(html).toContain("Guia autêntica");
    expect(html).not.toContain("Algo deu errado");
    expect(html).not.toContain(verificationToken);
  });
});
