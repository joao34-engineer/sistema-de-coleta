import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rateLimitMode: "ok" as "ok" | "exceeded" | "unavailable",
  retryAfterSeconds: 42,
  signInError: false,
  clientThrows: false,
  createClientOptions: undefined as { cookieMutation?: "best-effort" | "required" } | undefined,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.19" }),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

vi.mock("@/shared/lib/rate-limit.server", async () => {
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
    DocumentRateLimitExceededError: TestRateLimitExceededError,
    DocumentRateLimitUnavailableError: TestRateLimitUnavailableError,
    enforceLoginRateLimit: async () => {
      if (testState.rateLimitMode === "exceeded") throw new TestRateLimitExceededError(testState.retryAfterSeconds);
      if (testState.rateLimitMode === "unavailable") throw new TestRateLimitUnavailableError();
    },
  };
});

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async (options?: { cookieMutation?: "best-effort" | "required" }) => {
    testState.createClientOptions = options;
    if (testState.clientThrows) throw new Error("cookie_mutation_failed");
    return {
      auth: {
        signInWithPassword: async () =>
          testState.signInError ? { error: { message: "Invalid login credentials" } } : { error: null },
      },
    };
  },
}));

import { signInAction } from "../../src/_pages/login/api/actions";
import { initialLoginActionState } from "../../src/shared/lib/action-result";

function loginForm(email = "admin@example.com", password = "a-valid-password"): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("signInAction rate limit", () => {
  beforeEach(() => {
    testState.rateLimitMode = "ok";
    testState.signInError = false;
    testState.clientThrows = false;
    testState.createClientOptions = undefined;
  });

  it("returns a generic rate-limit state without leaking credentials", async () => {
    testState.rateLimitMode = "exceeded";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." });
    expect(JSON.stringify(result)).not.toContain("a-valid-password");
    expect(JSON.stringify(result)).not.toContain("admin@example.com");
  });

  it("fails closed when the rate-limit secret or service is unavailable", async () => {
    testState.rateLimitMode = "unavailable";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." });
  });

  it("keeps invalid credentials generic after the rate-limit check passes", async () => {
    testState.signInError = true;
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "invalid_credentials", message: "E-mail ou senha inválidos." });
  });
});

describe("signInAction cookie mutation", () => {
  beforeEach(() => {
    testState.rateLimitMode = "ok";
    testState.signInError = false;
    testState.clientThrows = false;
    testState.createClientOptions = undefined;
  });

  it("passes required cookie mutation mode to the supabase client", async () => {
    await expect(signInAction(initialLoginActionState, loginForm())).rejects.toThrow("redirect");
    expect(testState.createClientOptions).toEqual({ cookieMutation: "required" });
  });

  it("returns unexpected_error and does not redirect when cookie mutation fails", async () => {
    testState.clientThrows = true;
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "unexpected_error", message: "Não foi possível concluir o login agora." });
    expect(testState.createClientOptions).toEqual({ cookieMutation: "required" });
  });
});
