import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});

type ClaimsResult = {
  data: { claims: { sub?: string } | null } | null;
  error: { message?: string } | null;
};

const testState = vi.hoisted(() => ({
  getClaims: vi.fn(async (): Promise<ClaimsResult> => ({
    data: { claims: { sub: "00000000-0000-0000-0000-000000000001" } },
    error: null,
  })),
  setAllThrows: false,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {
      if (testState.setAllThrows) throw new Error("cookies_locked");
    },
  }),
}));

vi.mock("@/shared/config/environment", () => ({
  getPublicEnvironment: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "publishable-key",
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (values: ReadonlyArray<{ name: string; value: string }>) => void } },
  ) => ({
    auth: { getClaims: testState.getClaims },
    rpc: vi.fn(),
    from: vi.fn(),
    __setAll: options.cookies.setAll,
  }),
}));

describe("createOperationsCommandSupabaseClient", () => {
  beforeEach(() => {
    vi.resetModules();
    testState.getClaims.mockReset();
    testState.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-0000-0000-000000000001" } },
      error: null,
    });
    testState.setAllThrows = false;
  });

  it("hydrates auth with getClaims before returning the command client", async () => {
    const { createOperationsCommandSupabaseClient } = await import(
      "@/_pages/collection-operations/api/operations-supabase"
    );
    await createOperationsCommandSupabaseClient();
    expect(testState.getClaims).toHaveBeenCalledTimes(1);
  });

  it("rejects when the session cannot be hydrated", async () => {
    testState.getClaims.mockResolvedValueOnce({
      data: { claims: {} },
      error: null,
    });
    const { createOperationsCommandSupabaseClient } = await import(
      "@/_pages/collection-operations/api/operations-supabase"
    );
    const { AuthenticationRequiredError } = await import("@/shared/auth/require-admin");
    await expect(createOperationsCommandSupabaseClient()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });
});
