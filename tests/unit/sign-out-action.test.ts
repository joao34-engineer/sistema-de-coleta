import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  signOutError: null as { message: string } | null,
  signOutThrows: false,
  redirectThrown: false,
  revalidated: [] as Array<Readonly<{ path: string; type?: string }>>,
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    testState.revalidated.push({ path, ...(type !== undefined ? { type } : {}) });
  },
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
      signOut: async () => {
        if (testState.signOutThrows) throw new Error("cookie_write_failed");
        return testState.signOutError ? { error: testState.signOutError } : { error: null };
      },
    },
  }),
}));

import { signOutAction, initialSignOutState } from "../../src/shared/auth/actions";

describe("signOutAction", () => {
  beforeEach(() => {
    testState.signOutError = null;
    testState.signOutThrows = false;
    testState.redirectThrown = false;
    testState.revalidated = [];
  });

  it("revalidates the layout and redirects on success", async () => {
    await expect(signOutAction(initialSignOutState)).rejects.toThrow("redirect");
    expect(testState.redirectThrown).toBe(true);
    expect(testState.revalidated).toEqual([{ path: "/", type: "layout" }]);
  });

  it("returns an error state without redirect on auth failure", async () => {
    testState.signOutError = { message: "session_missing" };
    const result = await signOutAction(initialSignOutState);
    expect(result).toEqual({
      status: "error",
      message: "Não foi possível encerrar a sessão. Tente novamente.",
    });
    expect(testState.redirectThrown).toBe(false);
    expect(testState.revalidated).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("session_missing");
  });

  it("returns an error state without redirect when cookie mutation throws", async () => {
    testState.signOutThrows = true;
    const result = await signOutAction(initialSignOutState);
    expect(result.status).toBe("error");
    expect(testState.redirectThrown).toBe(false);
    expect(testState.revalidated).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("cookie_write_failed");
  });

  it("does not log the auth error message", async () => {
    testState.signOutError = { message: "user@example.com" };
    const result = await signOutAction(initialSignOutState);
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("user@example.com");
  });
});
