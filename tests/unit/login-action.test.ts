import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rateLimitMode: "ok" as
    | "ok"
    | "exceeded"
    | "unavailable"
    | "secret_missing"
    | "service_invalid"
    | "project_mismatch",
  retryAfterSeconds: 42,
  signInError: false,
  signInCalls: 0,
  resetCalls: 0,
  resetThrows: false,
  clientThrows: false,
  createClientOptions: undefined as { cookieMutation?: "best-effort" | "required" } | undefined,
  logs: [] as Array<Readonly<{ code: string; operation: string; status: number }>>,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.19" }),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

vi.mock("@/shared/lib/server-logger", () => ({
  getRequestId: () => "test-request-id",
  logTransactionFailure: (event: Readonly<{ code: string; operation: string; status: number }>) => {
    testState.logs.push({ code: event.code, operation: event.operation, status: event.status });
  },
}));

vi.mock("@/shared/lib/rate-limit.server", async () => {
  const { ServiceEnvironmentInvalidError, ServiceEnvironmentMismatchError } = await import(
    "@/shared/config/environment"
  );

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
  class TestRateLimitSecretMissingError extends TestRateLimitUnavailableError {
    constructor() {
      super();
      this.name = "DocumentRateLimitSecretMissingError";
    }
  }

  return {
    DocumentRateLimitExceededError: TestRateLimitExceededError,
    DocumentRateLimitUnavailableError: TestRateLimitUnavailableError,
    DocumentRateLimitSecretMissingError: TestRateLimitSecretMissingError,
    enforceLoginRateLimit: async () => {
      if (testState.rateLimitMode === "exceeded") {
        throw new TestRateLimitExceededError(testState.retryAfterSeconds);
      }
      if (testState.rateLimitMode === "secret_missing") {
        throw new TestRateLimitSecretMissingError();
      }
      if (testState.rateLimitMode === "service_invalid") {
        throw new ServiceEnvironmentInvalidError();
      }
      if (testState.rateLimitMode === "project_mismatch") {
        throw new ServiceEnvironmentMismatchError();
      }
      if (testState.rateLimitMode === "unavailable") {
        throw new TestRateLimitUnavailableError();
      }
    },
    resetLoginRateLimit: async () => {
      testState.resetCalls += 1;
      if (testState.resetThrows) throw new TestRateLimitUnavailableError();
    },
  };
});

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async (options?: { cookieMutation?: "best-effort" | "required" }) => {
    testState.createClientOptions = options;
    if (testState.clientThrows) throw new Error("cookie_mutation_failed");
    return {
      auth: {
        signInWithPassword: async () => {
          testState.signInCalls += 1;
          return testState.signInError ? { error: { message: "Invalid login credentials" } } : { error: null };
        },
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

function expectNoCredentials(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("a-valid-password");
  expect(serialized).not.toContain("admin@example.com");
}

describe("signInAction rate limit", () => {
  beforeEach(() => {
    testState.rateLimitMode = "ok";
    testState.signInError = false;
    testState.signInCalls = 0;
    testState.resetCalls = 0;
    testState.resetThrows = false;
    testState.clientThrows = false;
    testState.createClientOptions = undefined;
    testState.logs = [];
  });

  it("returns a generic rate-limit state without leaking credentials", async () => {
    testState.rateLimitMode = "exceeded";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." });
    expectNoCredentials(result);
    expect(testState.signInCalls).toBe(0);
    expect(testState.resetCalls).toBe(0);
  });

  it("fails closed when the rate-limit secret or service is unavailable", async () => {
    testState.rateLimitMode = "unavailable";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." });
    expect(testState.logs).toEqual([{ code: "rate_limit_rpc_failed", operation: "sign_in", status: 503 }]);
    expectNoCredentials(testState.logs);
  });

  it("logs rate_limit_secret_missing without email or password", async () => {
    testState.rateLimitMode = "secret_missing";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result.code).toBe("temporarily_unavailable");
    expect(testState.logs).toEqual([{ code: "rate_limit_secret_missing", operation: "sign_in", status: 503 }]);
    expectNoCredentials(testState.logs);
    expect(testState.signInCalls).toBe(0);
  });

  it("logs service_env_invalid when service variables fail validation", async () => {
    testState.rateLimitMode = "service_invalid";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." });
    expect(testState.logs).toEqual([{ code: "service_env_invalid", operation: "sign_in", status: 503 }]);
    expectNoCredentials(testState.logs);
  });

  it("logs service_project_ref_mismatch when the confirm ref does not match the URL", async () => {
    testState.rateLimitMode = "project_mismatch";
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result.code).toBe("temporarily_unavailable");
    expect(testState.logs).toEqual([{ code: "service_project_ref_mismatch", operation: "sign_in", status: 503 }]);
    expectNoCredentials(testState.logs);
  });

  it("keeps invalid credentials generic after the rate-limit check passes", async () => {
    testState.signInError = true;
    const result = await signInAction(initialLoginActionState, loginForm());
    expect(result).toEqual({ status: "error", code: "invalid_credentials", message: "E-mail ou senha inválidos." });
    expect(testState.resetCalls).toBe(0);
  });

  it("resets the login window only after a successful sign-in", async () => {
    await expect(signInAction(initialLoginActionState, loginForm())).rejects.toThrow("redirect");
    expect(testState.signInCalls).toBe(1);
    expect(testState.resetCalls).toBe(1);
  });

  it("still redirects when reset fails and logs rate_limit_reset_failed", async () => {
    testState.resetThrows = true;
    await expect(signInAction(initialLoginActionState, loginForm())).rejects.toThrow("redirect");
    expect(testState.logs).toEqual([{ code: "rate_limit_reset_failed", operation: "sign_in", status: 503 }]);
    expectNoCredentials(testState.logs);
  });
});

describe("signInAction cookie mutation", () => {
  beforeEach(() => {
    testState.rateLimitMode = "ok";
    testState.signInError = false;
    testState.signInCalls = 0;
    testState.resetCalls = 0;
    testState.resetThrows = false;
    testState.clientThrows = false;
    testState.createClientOptions = undefined;
    testState.logs = [];
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
    expect(testState.resetCalls).toBe(0);
  });
});
