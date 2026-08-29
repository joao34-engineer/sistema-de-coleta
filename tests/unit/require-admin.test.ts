import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";

const testState = vi.hoisted(() => ({
  userId: undefined as string | undefined,
  email: undefined as string | undefined,
  profile: null as Readonly<{ full_name: string | null; status: string }> | null,
  membership: null as Readonly<{ organization_id: number; role_code: string; status: string }> | null,
  organization: null as Readonly<{ display_name: string }> | null,
}));

vi.mock("@/shared/auth/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: {
          claims: testState.userId && testState.email ? { sub: testState.userId, email: testState.email } : {},
        },
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "profiles") return { data: testState.profile };
            if (table === "organizations") return { data: testState.organization };
            return { data: null };
          },
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: testState.membership }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

describe("requireAuthenticatedAdministrator", () => {
  beforeEach(() => {
    testState.userId = undefined;
    testState.email = undefined;
    testState.profile = null;
    testState.membership = null;
    testState.organization = null;
  });

  it("rejects an anonymous session with 401 semantics", async () => {
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("rejects an authenticated user without administrator role with 403 semantics", async () => {
    testState.userId = "00000000-0000-0000-0000-000000000099";
    testState.email = "user@example.com";
    testState.profile = { full_name: "Operador", status: "active" };
    testState.membership = null;
    await expect(requireAuthenticatedAdministrator()).rejects.toBeInstanceOf(AdministratorAccessDeniedError);
  });
});
