import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  signOutError: null as { message: string } | null,
  redirectThrown: false,
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    testState.redirectThrown = true;
    throw new Error("redirect");
  },
}));

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      signOut: async () => (testState.signOutError ? { error: testState.signOutError } : { error: null }),
    },
  }),
}));

import { signOutAction, initialSignOutState } from "../../src/shared/auth/actions";

describe("signOutAction", () => {
  beforeEach(() => {
    testState.signOutError = null;
    testState.redirectThrown = false;
  });

  it("redirects on success", async () => {
    await expect(signOutAction(initialSignOutState)).rejects.toThrow("redirect");
    expect(testState.redirectThrown).toBe(true);
  });

  it("returns an error state without redirect on auth failure", async () => {
    testState.signOutError = { message: "session_missing" };
    const result = await signOutAction(initialSignOutState);
    expect(result).toEqual({
      status: "error",
      message: "Não foi possível encerrar a sessão. Tente novamente.",
    });
    expect(testState.redirectThrown).toBe(false);
    expect(JSON.stringify(result)).not.toContain("session_missing");
  });

  it("does not log the auth error message", async () => {
    testState.signOutError = { message: "user@example.com" };
    const result = await signOutAction(initialSignOutState);
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("user@example.com");
  });
});
