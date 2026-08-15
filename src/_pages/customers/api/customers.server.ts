import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { normalizeDigits } from "@/shared/lib/cnpj";
import { customerIdSchema, customerInputSchema, customerPatchSchema, customerSearchSchema, type CustomerDTO } from "../model/customer";

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
type Query = PromiseLike<DatabaseResponse> & {
  select(columns: string): Query;
  insert(values: unknown): Query;
  update(values: unknown): Query;
  eq(column: string, value: unknown): Query;
  gt(column: string, value: unknown): Query;
  or(filters: string): Query;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): Query;
  limit(count: number): Query;
  maybeSingle(): Query;
};
type PhaseOneClient = Readonly<{ from(table: "customers"): Query }>;

const customerColumns = "id,display_name,tax_id,phone,created_at,updated_at";
const customerRowSchema = z.object({ id: z.string().uuid(), display_name: z.string(), tax_id: z.string().regex(/^\d{11}$|^\d{14}$/), phone: z.string().regex(/^\d{10,11}$/), created_at: z.string(), updated_at: z.string() });

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function result(status: number, body: unknown): NextResponse {
  return noStore(NextResponse.json(body, { status }));
}

function apiError(error: unknown): NextResponse {
  if (error instanceof AuthenticationRequiredError) return result(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return result(403, { ok: false, code: "forbidden" });
  return result(500, { ok: false, code: "unexpected_error" });
}

function mapCustomer(row: unknown): CustomerDTO | null {
  const parsed = customerRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return { id: parsed.data.id, displayName: parsed.data.display_name, taxId: parsed.data.tax_id, phone: parsed.data.phone, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at };
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function listCustomers(request: Request): Promise<NextResponse> {
  try {
    const query = customerSearchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return result(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const normalizedSearch = normalizeDigits(query.data.q);
    let databaseQuery = supabase.from("customers").select(customerColumns).eq("organization_id", administrator.organizationId).eq("status", "active").order("id", { ascending: true }).limit(query.data.limit + 1);
    if (query.data.cursor) databaseQuery = databaseQuery.gt("id", query.data.cursor);
    if (query.data.q) {
      const terms = [`display_name.ilike.*${query.data.q.replace(/[,%()]/g, "")}*`];
      if (normalizedSearch) terms.push(`tax_id.ilike.*${normalizedSearch}*`, `phone.ilike.*${normalizedSearch}*`);
      databaseQuery = databaseQuery.or(terms.join(","));
    }
    const { data, error } = await databaseQuery;
    if (error || !Array.isArray(data)) return result(500, { ok: false, code: "customer_query_failed" });
    const customers = data.map(mapCustomer).filter((value): value is CustomerDTO => value !== null);
    const hasMore = customers.length > query.data.limit;
    const page = hasMore ? customers.slice(0, query.data.limit) : customers;
    return result(200, { ok: true, data: { customers: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null } });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function createCustomer(request: Request): Promise<NextResponse> {
  try {
    const input = customerInputSchema.safeParse(await parseJson(request));
    if (!input.success) return result(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const existing = await supabase.from("customers").select(customerColumns).eq("organization_id", administrator.organizationId).eq("tax_id", input.data.taxId).maybeSingle();
    if (existing.error) return result(500, { ok: false, code: "customer_query_failed" });
    const existingCustomer = mapCustomer(existing.data);
    if (existingCustomer) return result(409, { ok: false, code: "duplicate_tax_id", data: { customer: existingCustomer } });
    const { data, error } = await supabase.from("customers").insert({ organization_id: administrator.organizationId, display_name: input.data.displayName, tax_id: input.data.taxId, phone: input.data.phone, status: "active", created_by: administrator.userId, updated_by: administrator.userId }).select(customerColumns).maybeSingle();
    const customer = mapCustomer(data);
    if (error || !customer) return result(500, { ok: false, code: "customer_create_failed" });
    return result(201, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function getCustomer(id: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(id);
    if (!parsedId.success) return result(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.from("customers").select(customerColumns).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).maybeSingle();
    const customer = mapCustomer(data);
    if (error) return result(500, { ok: false, code: "customer_query_failed" });
    if (!customer) return result(404, { ok: false, code: "not_found" });
    return result(200, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function patchCustomer(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(id);
    const input = customerPatchSchema.safeParse(await parseJson(request));
    if (!parsedId.success || !input.success) return result(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const values = { ...(input.data.displayName === undefined ? {} : { display_name: input.data.displayName }), ...(input.data.taxId === undefined ? {} : { tax_id: input.data.taxId }), ...(input.data.phone === undefined ? {} : { phone: input.data.phone }), updated_by: administrator.userId };
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.from("customers").update(values).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "active").select(customerColumns).maybeSingle();
    const customer = mapCustomer(data);
    if (error) return result(409, { ok: false, code: "customer_update_conflict" });
    if (!customer) return result(404, { ok: false, code: "not_found" });
    return result(200, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return apiError(error);
  }
}
