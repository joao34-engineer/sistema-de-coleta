import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/shared/auth/same-origin";

describe("isSameOriginRequest", () => {
  it("accepts a matching Origin header", () => {
    const request = new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "https://sistema-de-coleta.vercel.app" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects a cross-site Origin header", () => {
    const request = new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("accepts a same-origin Referer when Origin is absent", () => {
    const request = new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", {
      method: "POST",
      headers: { referer: "https://sistema-de-coleta.vercel.app/dashboard" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects a request with neither Origin nor Referer", () => {
    const request = new Request("https://sistema-de-coleta.vercel.app/api/auth/sign-out", { method: "POST" });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
