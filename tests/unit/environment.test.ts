import { afterEach, describe, expect, it } from "vitest";
import {
  getBootstrapEnvironment,
  getPublicEnvironment,
  getServiceEnvironment,
  hasPublicEnvironment,
  ServiceEnvironmentMismatchError,
} from "@/shared/config/environment";
import { projectRefFromUrl } from "@/shared/config/project-ref";

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

  it("parses the Supabase project ref from the API URL", () => {
    expect(projectRefFromUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
  });

  it("returns the service environment when the confirm ref matches the URL host", () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://abcdefghijklmnop.supabase.co";
    process.env["SUPABASE_SECRET_KEY"] = "super-secret-service-role-key";
    process.env["SUPABASE_CONFIRM_PROJECT_REF"] = "abcdefghijklmnop";
    expect(getServiceEnvironment()).toEqual({
      supabaseUrl: "https://abcdefghijklmnop.supabase.co",
      supabaseSecretKey: "super-secret-service-role-key",
      confirmProjectRef: "abcdefghijklmnop",
    });
  });

  it("throws without leaking the secret when the service key is missing", () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://abcdefghijklmnop.supabase.co";
    process.env["SUPABASE_SECRET_KEY"] = "super-secret-service-role-key";
    process.env["SUPABASE_CONFIRM_PROJECT_REF"] = "abcdefghijklmnop";
    delete process.env["SUPABASE_SECRET_KEY"];
    expect(() => getServiceEnvironment()).toThrow(/Variáveis de serviço Supabase ausentes ou inválidas/);
    try {
      getServiceEnvironment();
    } catch (error) {
      expect(serializeError(error)).not.toContain("super-secret-service-role-key");
    }
  });

  it("throws without leaking the secret when the public URL is invalid", () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "not-a-url";
    process.env["SUPABASE_SECRET_KEY"] = "super-secret-service-role-key";
    process.env["SUPABASE_CONFIRM_PROJECT_REF"] = "abcdefghijklmnop";
    expect(() => getServiceEnvironment()).toThrow(/Variáveis de serviço Supabase ausentes ou inválidas/);
    try {
      getServiceEnvironment();
    } catch (error) {
      expect(serializeError(error)).not.toContain("super-secret-service-role-key");
    }
  });

  it("throws ServiceEnvironmentMismatchError without leaking the secret when the confirm ref does not match", () => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://abcdefghijklmnop.supabase.co";
    process.env["SUPABASE_SECRET_KEY"] = "super-secret-service-role-key";
    process.env["SUPABASE_CONFIRM_PROJECT_REF"] = "otherprojectref000";
    expect(() => getServiceEnvironment()).toThrow(ServiceEnvironmentMismatchError);
    try {
      getServiceEnvironment();
    } catch (error) {
      expect(serializeError(error)).not.toContain("super-secret-service-role-key");
      expect(serializeError(error)).toContain("SUPABASE_CONFIRM_PROJECT_REF");
    }
  });
});

function serializeError(error: unknown): string {
  if (!(error instanceof Error)) return JSON.stringify(error);
  return JSON.stringify({ name: error.name, message: error.message, stack: error.stack });
}
