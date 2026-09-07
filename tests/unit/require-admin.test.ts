import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator, requireAuthenticatedAdministratorForPage } from "@/shared/auth/require-admin";

const testState = vi.hoisted(() => ({
  userId: undefined as string | undefined,
  email: undefined as string | undefined,
  profile: null as Readonly<{ full_name: string | null; status: string }> | null,
  membership: null as Readonly<{ organization_id: number; role_code: string; status: string }> | null,
  organization: null as Readonly<{ display_name: string }> | null,
  getClaimsThrows: false,
  redirectThrown: false,
}));

function buildQuery(table: string) {
  const filters: Record<string, string> = {};

  const chain = {
    select: () => chain,
    eq: (column: string, value: string | number) => {
      filters[column] = String(value);
      return chain;
    },
    maybeSingle: async () => {
      if (table === "profiles") {
        if (filters["user_id"] === testState.userId) return { data: testState.profile };
        return { data: null };
      }
      if (table === "organization_memberships") {
        if (
          filters["user_id"] === testState.userId &&
          filters["status"] === "active" &&
          filters["role_code"] === "administrator"
        ) {
          return { data: testState.membership };
        }
        return { data: null };
      }
      if (table === "organizations") {
        if (filters["id"] === String(testState.membership?.organization_id)) return { data: testState.organization };
        return { data: null };
      }
      return { data: null };
    },
  };

  return chain;
}

vi.mock("next/navigation", () => ({
  redirect: () => {
    testState.redirectThrown = true;
    throw new Error("redirect");
  },
}));

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getClaims: async () => {
        if (testState.getClaimsThrows) throw new Error("jwt_invalid");
        return {
          data: {
            claims: testState.userId && testState.email ? { sub: testState.userId, email: testState.email } : {},
          },
        };
      },
    },
    from: (table: string) => buildQuery(table),
  }),
}));

describe("requireAuthenticatedAdministrator", () => {
  beforeEach(() => {
    testState.userId = undefined;
    testState.email = undefined;
    testState.profile = null;
    testState.membership = null;
    testState.organization = null;
    testState.getClaimsThrows = false;
    testState.redirectThrown = false;
  });

  it("rejects an anonymous session with 401 semantics", async () => {
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("maps a thrown getClaims failure to authentication required, not a generic render error", async () => {
    testState.getClaimsThrows = true;
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("rejects an authenticated user without an active administrator membership (missing membership)", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "user@example.com";
    testState.profile = { full_name: "Operador", status: "active" };
    testState.membership = null;
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("rejects an authenticated user with non-administrator role_code", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "operator@example.com";
    testState.profile = { full_name: "Operador", status: "active" };
    testState.membership = { organization_id: 1, role_code: "operator", status: "active" };
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("rejects an authenticated user with inactive membership status", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "suspended@example.com";
    testState.profile = { full_name: "Suspenso", status: "active" };
    testState.membership = { organization_id: 1, role_code: "administrator", status: "inactive" };
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("rejects an authenticated user with inactive profile.status", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "inactive@example.com";
    testState.profile = { full_name: "Inativo", status: "inactive" };
    testState.membership = { organization_id: 1, role_code: "administrator", status: "active" };
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("rejects an authenticated user with valid membership but missing organization", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "orphan@example.com";
    testState.profile = { full_name: "Orfão", status: "active" };
    testState.membership = { organization_id: 999, role_code: "administrator", status: "active" };
    testState.organization = null;
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });

  it("returns an administrator when all checks pass", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000001";
    testState.email = "admin@example.com";
    testState.profile = { full_name: "Administrador", status: "active" };
    testState.membership = { organization_id: 1, role_code: "administrator", status: "active" };
    testState.organization = { display_name: "MJT" };

    const result = await requireAuthenticatedAdministrator();
    expect(result).toEqual({
      userId: testState.userId,
      email: testState.email,
      organizationId: 1,
      organizationName: "MJT",
      fullName: "Administrador",
      role: "administrator",
    });
  });
});

describe("requireAuthenticatedAdministratorForPage", () => {
  beforeEach(() => {
    testState.userId = undefined;
    testState.email = undefined;
    testState.profile = null;
    testState.membership = null;
    testState.organization = null;
    testState.getClaimsThrows = false;
    testState.redirectThrown = false;
  });

  it("redirects to login when the session is missing", async () => {
    await expect(requireAuthenticatedAdministratorForPage()).rejects.toThrow("redirect");
    expect(testState.redirectThrown).toBe(true);
  });

  it("redirects to login when getClaims throws", async () => {
    testState.getClaimsThrows = true;
    await expect(requireAuthenticatedAdministratorForPage()).rejects.toThrow("redirect");
    expect(testState.redirectThrown).toBe(true);
  });

  it("still throws access denied for a signed-in user without administrator membership", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "user@example.com";
    testState.profile = { full_name: "Operador", status: "active" };
    testState.membership = null;
    await expect(requireAuthenticatedAdministratorForPage()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
    expect(testState.redirectThrown).toBe(false);
  });
});
