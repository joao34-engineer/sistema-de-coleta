import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  setAllError: null as Error | null,
  capturedSetAll: null as ((cookies: ReadonlyArray<{ name: string; value: string; options: object }>) => void) | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {
      if (testState.setAllError) throw testState.setAllError;
    },
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        getAll: () => ReadonlyArray<{ name: string; value: string }>;
        setAll: (cookies: ReadonlyArray<{ name: string; value: string; options: object }>) => void;
      };
    },
  ) => {
    testState.capturedSetAll = options.cookies.setAll;
    return {};
  },
}));

vi.mock("@/shared/config/environment", () => ({
  getPublicEnvironment: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "example-anon-key",
  }),
}));

import { createServerSupabaseClient } from "../../src/shared/auth/supabase-server";

function capturedSetAll() {
  const setAll = testState.capturedSetAll;
  if (setAll === null) {
    throw new Error("setAll was not captured");
  }
  return setAll;
}

describe("createServerSupabaseClient cookie mutation", () => {
  beforeEach(() => {
    testState.setAllError = null;
    testState.capturedSetAll = null;
  });

  it("swallows cookie write failures in best-effort mode by default", async () => {
    testState.setAllError = new Error("Cannot mutate cookies in a Server Component");
    await createServerSupabaseClient();
    expect(testState.capturedSetAll).toBeTypeOf("function");
    expect(() => capturedSetAll()([{ name: "sb-access-token", value: "x", options: {} }])).not.toThrow();
  });

  it("throws cookie write failures in required mode", async () => {
    testState.setAllError = new Error("Cannot mutate cookies in a Server Component");
    await createServerSupabaseClient({ cookieMutation: "required" });
    expect(testState.capturedSetAll).toBeTypeOf("function");
    expect(() => capturedSetAll()([{ name: "sb-access-token", value: "x", options: {} }])).toThrow(
      "Cannot mutate cookies in a Server Component",
    );
  });
});
