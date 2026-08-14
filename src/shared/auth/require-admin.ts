import "server-only";

import { createServerSupabaseClient } from "./supabase-server";

export type AuthenticatedAdministrator = Readonly<{
  userId: string;
  email: string;
  organizationId: number;
  organizationName: string;
  fullName: string | null;
  role: "administrator";
}>;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("authentication_required");
    this.name = "AuthenticationRequiredError";
  }
}

export class AdministratorAccessDeniedError extends Error {
  constructor() {
    super("administrator_access_denied");
    this.name = "AdministratorAccessDeniedError";
  }
}

export async function requireAuthenticatedAdministrator(): Promise<AuthenticatedAdministrator> {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims && typeof claimsData.claims.sub === "string" ? claimsData.claims.sub : undefined;
  const email = claimsData?.claims && typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;

  if (!userId || !email) throw new AuthenticationRequiredError();

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name,status").eq("user_id", userId).maybeSingle(),
    supabase.from("organization_memberships").select("organization_id,role_code,status").eq("user_id", userId).eq("status", "active").eq("role_code", "administrator").maybeSingle(),
  ]);

  if (!profile || profile.status !== "active" || !membership || membership.status !== "active" || membership.role_code !== "administrator") {
    throw new AdministratorAccessDeniedError();
  }

  const { data: organization } = await supabase.from("organizations").select("display_name").eq("id", membership.organization_id).maybeSingle();
  if (!organization) throw new AdministratorAccessDeniedError();

  return {
    userId,
    email,
    organizationId: membership.organization_id,
    organizationName: organization.display_name,
    fullName: profile.full_name,
    role: "administrator",
  };
}
