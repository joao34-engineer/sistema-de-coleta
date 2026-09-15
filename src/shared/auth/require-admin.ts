import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { routes } from "@/shared/config/routes";
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

type QueryError = { code?: string | undefined; message?: string | undefined } | null;

/**
 * Duck-typed auth surface shared by SSR Database clients and Operations clients.
 * Keep this loose: PostgREST builders are Thenables, not plain Promises.
 */
export type AdministratorAuthClient = {
  auth: {
    getClaims: () => PromiseLike<{ data: unknown; error: unknown }>;
  };
  from: (table: string) => {
    select: (columns: string) => AdminFilterBuilder;
  };
};

type AdminFilterBuilder = {
  eq: (column: string, value: string | number) => AdminFilterBuilder;
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
};

function asQueryError(value: unknown): QueryError {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

function claimsFromUnknown(data: unknown): { sub?: string | undefined; email?: string | undefined } {
  if (typeof data !== "object" || data === null) return {};
  const claims = (data as { claims?: unknown }).claims;
  if (typeof claims !== "object" || claims === null) return {};
  const record = claims as Record<string, unknown>;
  return {
    sub: typeof record["sub"] === "string" ? record["sub"] : undefined,
    email: typeof record["email"] === "string" ? record["email"] : undefined,
  };
}

function isAuthQueryFailure(error: QueryError): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST301" ||
    code === "PGRST303" ||
    code === "401" ||
    message.includes("jwt") ||
    message.includes("session") ||
    message.includes("not authenticated")
  );
}

function readProfile(data: unknown): { full_name: string | null; status: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as { full_name?: unknown; status?: unknown };
  if (typeof record.status !== "string") return null;
  return {
    full_name: typeof record.full_name === "string" || record.full_name === null ? record.full_name : null,
    status: record.status,
  };
}

function readMembership(data: unknown): { organization_id: number; role_code: string; status: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as { organization_id?: unknown; role_code?: unknown; status?: unknown };
  if (typeof record.organization_id !== "number" || typeof record.role_code !== "string" || typeof record.status !== "string") {
    return null;
  }
  return {
    organization_id: record.organization_id,
    role_code: record.role_code,
    status: record.status,
  };
}

function readOrganization(data: unknown): { display_name: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as { display_name?: unknown };
  if (typeof record.display_name !== "string") return null;
  return { display_name: record.display_name };
}

/**
 * Resolves the signed-in administrator against the provided Supabase client.
 * Callers that also run RPCs/storage must pass the same hydrated client so
 * `auth.uid()` and membership checks share one session (`skipAutoInitialize`).
 */
export async function resolveAuthenticatedAdministrator(
  supabase: AdministratorAuthClient,
): Promise<AuthenticatedAdministrator> {
  let userId: string | undefined;
  let email: string | undefined;
  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError) throw new AuthenticationRequiredError();
    const claims = claimsFromUnknown(claimsData);
    userId = claims.sub;
    email = claims.email;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) throw error;
    throw new AuthenticationRequiredError();
  }

  if (!userId || !email) throw new AuthenticationRequiredError();

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("full_name,status").eq("user_id", userId).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id,role_code,status")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("role_code", "administrator")
      .maybeSingle(),
  ]);

  if (isAuthQueryFailure(asQueryError(profileResult.error)) || isAuthQueryFailure(asQueryError(membershipResult.error))) {
    throw new AuthenticationRequiredError();
  }
  if (profileResult.error) throw profileResult.error;
  if (membershipResult.error) throw membershipResult.error;

  const profile = readProfile(profileResult.data);
  const membership = readMembership(membershipResult.data);

  if (!profile || profile.status !== "active" || !membership || membership.status !== "active" || membership.role_code !== "administrator") {
    throw new AdministratorAccessDeniedError();
  }

  const organizationResult = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (isAuthQueryFailure(asQueryError(organizationResult.error))) {
    throw new AuthenticationRequiredError();
  }
  if (organizationResult.error) throw organizationResult.error;

  const organization = readOrganization(organizationResult.data);
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

export function asAdministratorAuthClient(supabase: {
  auth: { getClaims: () => PromiseLike<{ data: unknown; error: unknown }> };
  from: (table: string) => unknown;
}): AdministratorAuthClient {
  return {
    auth: supabase.auth,
    from: (table: string) => supabase.from(table) as ReturnType<AdministratorAuthClient["from"]>,
  };
}

export const requireAuthenticatedAdministrator = cache(async (): Promise<AuthenticatedAdministrator> => {
  const supabase = await createServerSupabaseClient();
  return resolveAuthenticatedAdministrator(asAdministratorAuthClient(supabase));
});

/** Page/layout adapter: missing session navigates, it does not hit `error.tsx`. Commands keep throwing. */
export async function requireAuthenticatedAdministratorForPage(): Promise<AuthenticatedAdministrator> {
  try {
    return await requireAuthenticatedAdministrator();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect(routes.login);
    throw error;
  }
}
