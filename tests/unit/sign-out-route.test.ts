import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  signOutError: null as Error | null,
  revalidated: [] as Array<Readonly<{ path: string; type?: string }>>,
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    testState.revalidated.push({ path, ...(type !== undefined ? { type } : {}) });
  },
}));

vi.mock("@/shared/lib/server-logger", () => ({
  getRequestId: () => "test-request-id",
  logTransactionFailure: vi.fn(),
}));

vi.mock("@/shared/auth/end-session", () => ({
  endSession: async () => {
    if (testState.signOutError) throw testState.signOutError;
  },
}));

import { postSignOut } from "@/_app/api-routes/sign-out";

describe("postSignOut", () => {
  beforeEach(() => {
    testState.signOutError = null;
    testState.revalidated = [];
  });

  it("returns 403 for a cross-site POST without calling Auth", async () => {
    const response = await postSignOut(
      new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(testState.revalidated).toEqual([]);
  });

  it("revokes the session and returns 303 to login", async () => {
    const response = await postSignOut(
      new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
        method: "POST",
        headers: { origin: "https://sistema-de-coleta.vercel.app" },
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://sistema-de-coleta.vercel.app/login");
    expect(testState.revalidated).toEqual([{ path: "/", type: "layout" }]);
  });

  it("returns 500 without redirect when Auth sign-out fails", async () => {
    testState.signOutError = new Error("auth_logout_failed");
    const response = await postSignOut(
      new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
        method: "POST",
        headers: { origin: "https://sistema-de-coleta.vercel.app" },
      }),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("location")).toBeNull();
    expect(testState.revalidated).toEqual([]);
  });
});
