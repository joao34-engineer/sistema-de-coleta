import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  signOutError: null as { message: string } | null,
  signOutThrows: false,
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

import { endSession } from "@/shared/auth/end-session";

describe("endSession", () => {
  beforeEach(() => {
    testState.signOutError = null;
    testState.signOutThrows = false;
  });

  it("resolves when Auth sign-out succeeds", async () => {
    await expect(endSession()).resolves.toBeUndefined();
  });

  it("throws a stable error when Auth returns a failure, without leaking the message", async () => {
    testState.signOutError = { message: "user@example.com" };
    await expect(endSession()).rejects.toThrow("sign_out_failed");
    await expect(endSession()).rejects.not.toThrow("user@example.com");
  });

  it("throws when cookie mutation fails", async () => {
    testState.signOutThrows = true;
    await expect(endSession()).rejects.toThrow("cookie_write_failed");
  });
});
