import { afterEach, describe, expect, it } from "vitest";
import { getBootstrapEnvironment, getPublicEnvironment, hasPublicEnvironment } from "@/shared/config/environment";

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

describe("environment configuration", () => {
  it("returns false when public Supabase variables are absent", () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    delete process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
    expect(hasPublicEnvironment()).toBe(false);
  });

  it("reads the public environment without exposing bootstrap secrets", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000";
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://example.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] = "publishable-key";
    expect(getPublicEnvironment()).toEqual({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-key",
    });
  });

  it("identifies missing bootstrap variables without printing their values", () => {
    delete process.env["SUPABASE_SECRET_KEY"];
    delete process.env["BOOTSTRAP_ADMIN_EMAIL"];
    expect(() => getBootstrapEnvironment()).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() => getBootstrapEnvironment()).toThrow(/BOOTSTRAP_ADMIN_EMAIL/);
  });
});
