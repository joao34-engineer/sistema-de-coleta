import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "@/_app/api-routes/health";

describe("GET /api/health", () => {
  const originalUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const originalKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    else process.env["NEXT_PUBLIC_SUPABASE_URL"] = originalUrl;
    if (originalKey === undefined) delete process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
    else process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = originalKey;
  });

  it("returns 200 when Auth health and REST root are ok", async () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://qa.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = "qa-publishable-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/auth/v1/health")) {
        return new Response(JSON.stringify({ version: "must-not-leak", name: "GoTrue" }), { status: 200 });
      }
      if (url.includes("/rest/v1/")) {
        return new Response(JSON.stringify({ swagger: "must-not-leak" }), { status: 200 });
      }
      return new Response(null, { status: 500 });
    });

    const response = await getHealth();
    const body = (await response.json()) as Readonly<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ ok: true, status: "ok", checks: { app: "ok", supabase: "ok" } });
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    expect(JSON.stringify(body)).not.toContain("qa.supabase.co");
    expect(JSON.stringify(body)).not.toContain("qa-publishable-key");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("returns 503 when public env is missing", async () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    delete process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const response = await getHealth();
    const body = (await response.json()) as Readonly<Record<string, unknown>>;

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, status: "degraded", checks: { app: "ok", supabase: "fail" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when Auth health times out", async () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://qa.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = "qa-publishable-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/auth/v1/health")) throw new DOMException("The operation was aborted.", "TimeoutError");
      if (url.includes("/rest/v1/")) return new Response(null, { status: 200 });
      return new Response(null, { status: 500 });
    });

    const response = await getHealth();
    const body = (await response.json()) as Readonly<Record<string, unknown>>;

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, status: "degraded", checks: { app: "ok", supabase: "fail" } });
    expect(JSON.stringify(body)).not.toContain("TimeoutError");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
