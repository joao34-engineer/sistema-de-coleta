import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import { customerIdSchema, customerInputSchema, customerPatchSchema, customerSearchSchema, type CustomerDTO } from "../model/customer";
import { loadPrimaryCustomerAddress, mapCustomerAddress } from "./customer-addresses.server";

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
type Query = PromiseLike<DatabaseResponse> & {
  select(columns: string): Query;
  insert(values: unknown): Query;
  update(values: unknown): Query;
  eq(column: string, value: unknown): Query;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): Query;
  maybeSingle(): Query;
  gt(column: string, value: unknown): Query;
  or(filters: string): Query;
  ilike(column: string, value: string): Query;
  limit(count: number): Query;
};
type PhaseOneClient = Readonly<{
  from(table: "customers" | "customer_addresses"): Query;
  rpc(functionName: "create_customer_with_address", args: Readonly<Record<string, unknown>>): Promise<DatabaseResponse>;
}>;

const customerColumns = "id,legal_name,tax_id,phone,created_at,updated_at";
const customerRowSchema = z.object({ id: z.string().uuid(), legal_name: z.string(), tax_id: z.string().regex(/^\d{11}$|^\d{14}$/), phone: z.string().regex(/^\d{10,11}$/), created_at: z.string(), updated_at: z.string() });

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function result(status: number, body: unknown): NextResponse {
  return noStore(NextResponse.json(body, { status }));
}

function propertyString(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || !(property in value)) return null;
  const candidate = value[property as keyof typeof value];
  return typeof candidate === "string" ? candidate : null;
}

function isUniqueViolation(error: unknown): boolean {
  if (propertyString(error, "code") !== "23505") return false;
  const text = `${propertyString(error, "constraint") ?? ""} ${propertyString(error, "message") ?? ""} ${propertyString(error, "details") ?? ""}`.toLowerCase();
  return text.includes("tax_id") || text.includes("customers_organization_id_tax_id_key") || text.length === 0;
}

function isPrimaryAddressViolation(error: unknown): boolean {
  if (propertyString(error, "code") !== "23505") return false;
  const text = `${propertyString(error, "constraint") ?? ""} ${propertyString(error, "message") ?? ""} ${propertyString(error, "details") ?? ""}`.toLowerCase();
  return text.includes("customer_addresses_primary") || text.includes("is_primary");
}

function errorResponse(error: unknown, request: Request, operation: string): NextResponse {
  if (error instanceof AuthenticationRequiredError) return result(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return result(403, { ok: false, code: "forbidden" });
  logTransactionFailure({ requestId: getRequestId(request), operation, code: "customer_unexpected_error", actorId: null, status: 500 });
  return result(500, { ok: false, code: "unexpected_error" });
}

function mapCustomer(row: unknown, address: ReturnType<typeof mapCustomerAddress> = null): CustomerDTO | null {
  const parsed = customerRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return { id: parsed.data.id, displayName: parsed.data.legal_name, taxId: parsed.data.tax_id, phone: parsed.data.phone, address, createdAt: parsed.data.created_at, updatedAt: parsed.data.updated_at };
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function findCustomerByTaxId(supabase: PhaseOneClient, organizationId: number, taxId: string): Promise<CustomerDTO | null> {
  const existing = await supabase.from("customers").select(customerColumns).eq("organization_id", organizationId).eq("tax_id", taxId).maybeSingle();
  if (existing.error) return null;
  return mapCustomer(existing.data);
}

async function loadPrimaryAddress(supabase: PhaseOneClient, organizationId: number, customerId: string) {
  return loadPrimaryCustomerAddress(supabase, organizationId, customerId);
}

function objectProperty(value: unknown, property: string): unknown {
  return typeof value === "object" && value !== null && property in value ? value[property as keyof typeof value] : undefined;
}

function uuidProperty(value: unknown, property: string): string | null {
  const candidate = objectProperty(value, property);
  return typeof candidate === "string" && z.string().uuid().safeParse(candidate).success ? candidate : null;
}

function customerIdFromCreation(value: unknown): string | null {
  return uuidProperty(value, "customerId") ?? uuidProperty(value, "id") ?? uuidProperty(objectProperty(value, "customer"), "id");
}

function addressRpcPayload(input: NonNullable<z.output<typeof customerInputSchema>["address"]>): Record<string, unknown> {
  return {
    label: input.label ?? null,
    street: input.street,
    street_number: input.streetNumber ?? null,
    address_complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city,
    state_code: input.stateCode,
    postal_code: input.postalCode ?? null,
    is_primary: input.isPrimary,
  };
}

export async function listCustomers(request: Request): Promise<NextResponse> {
  try {
    const query = customerSearchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return result(400, { ok: false, code: "validation_error" });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const normalizedSearch = query.data.q.replace(/[^\d]/g, "");
    let databaseQuery = supabase.from("customers").select(customerColumns).eq("organization_id", administrator.organizationId).eq("status", "active").order("legal_name", { ascending: true }).order("id", { ascending: true }).limit(query.data.limit + 1);
    if (query.data.cursor) databaseQuery = databaseQuery.gt("id", query.data.cursor);
    if (query.data.q) {
      const safeText = query.data.q.replace(/[,%()*.]/g, "");
      const terms = [`legal_name.ilike.*${safeText}*`];
      if (normalizedSearch) terms.push(`tax_id.ilike.*${normalizedSearch}*`, `phone.ilike.*${normalizedSearch}*`);
      databaseQuery = databaseQuery.or(terms.join(","));
    }
    const { data, error } = await databaseQuery;
    if (error || !Array.isArray(data)) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "list_customers", code: "customer_query_failed", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_query_failed" });
    }
    const customers = data.map((row) => mapCustomer(row)).filter((value): value is CustomerDTO => value !== null);
    const hasMore = customers.length > query.data.limit;
    const page = hasMore ? customers.slice(0, query.data.limit) : customers;
    return result(200, { ok: true, data: { customers: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null } });
  } catch (error: unknown) {
    return errorResponse(error, request, "list_customers");
  }
}

export async function createCustomer(request: Request): Promise<NextResponse> {
  try {
    const input = customerInputSchema.safeParse(await parseJson(request));
    if (!input.success) return result(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.rpc("create_customer_with_address", {
      p_legal_name: input.data.displayName,
      p_tax_id: input.data.taxId,
      p_phone: input.data.phone,
      p_address: input.data.address ? addressRpcPayload(input.data.address) : null,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        const existingCustomer = await findCustomerByTaxId(supabase, administrator.organizationId, input.data.taxId);
        return result(409, { ok: false, code: "duplicate_tax_id", ...(existingCustomer ? { data: { customer: existingCustomer } } : {}) });
      }
      if (isPrimaryAddressViolation(error)) return result(409, { ok: false, code: "primary_address_conflict" });
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer", code: "customer_create_failed", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_create_failed" });
    }
    const customerId = customerIdFromCreation(data);
    if (!customerId) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer", code: "customer_create_contract_invalid", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_create_contract_invalid" });
    }
    const customerRecord = await supabase.from("customers").select(customerColumns).eq("organization_id", administrator.organizationId).eq("id", customerId).maybeSingle();
    if (customerRecord.error) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer", code: "customer_create_readback_failed", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_create_readback_failed" });
    }
    const customer = mapCustomer(customerRecord.data, await loadPrimaryAddress(supabase, administrator.organizationId, customerId));
    if (!customer) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer", code: "customer_create_contract_invalid", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_create_contract_invalid" });
    }
    return result(201, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return errorResponse(error, request, "create_customer");
  }
}

export type LoadCustomerResult =
  | { ok: true; customer: CustomerDTO }
  | { ok: false; reason: "invalid_id" | "not_found" | "query_failed" | "contract_invalid" };

export async function loadCustomerDto(id: string): Promise<LoadCustomerResult> {
  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, reason: "invalid_id" };
  }
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
  const { data, error } = await supabase
    .from("customers")
    .select(customerColumns)
    .eq("organization_id", administrator.organizationId)
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: "query_failed" };
  }
  if (!data) {
    return { ok: false, reason: "not_found" };
  }
  const customer = mapCustomer(data, await loadPrimaryAddress(supabase, administrator.organizationId, parsedId.data));
  if (!customer) {
    return { ok: false, reason: "contract_invalid" };
  }
  return { ok: true, customer };
}

export async function getCustomer(id: string, request: Request): Promise<NextResponse> {
  try {
    const loaded = await loadCustomerDto(id);
    if (loaded.ok) {
      return result(200, { ok: true, data: { customer: loaded.customer } });
    }
    if (loaded.reason === "invalid_id") {
      return result(400, { ok: false, code: "validation_error" });
    }
    if (loaded.reason === "not_found") {
      return result(404, { ok: false, code: "not_found" });
    }
    const administrator = await requireAuthenticatedAdministrator();
    const code = loaded.reason === "query_failed" ? "customer_query_failed" : "customer_query_contract_invalid";
    logTransactionFailure({
      requestId: getRequestId(request),
      operation: "get_customer",
      code,
      actorId: administrator.userId,
      status: 500,
    });
    return result(500, { ok: false, code });
  } catch (error: unknown) {
    return errorResponse(error, request, "get_customer");
  }
}

export async function patchCustomer(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(id);
    const input = customerPatchSchema.safeParse(await parseJson(request));
    if (!parsedId.success || !input.success) return result(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const values = { ...(input.data.displayName === undefined ? {} : { legal_name: input.data.displayName }), ...(input.data.taxId === undefined ? {} : { tax_id: input.data.taxId }), ...(input.data.phone === undefined ? {} : { phone: input.data.phone }), updated_by: administrator.userId };
    const supabase = (await createServerSupabaseClient()) as unknown as PhaseOneClient;
    const { data, error } = await supabase.from("customers").update(values).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "active").select(customerColumns).maybeSingle();
    if (error) {
      if (isUniqueViolation(error)) {
        const existingCustomer = input.data.taxId ? await findCustomerByTaxId(supabase, administrator.organizationId, input.data.taxId) : null;
        return result(409, { ok: false, code: "duplicate_tax_id", ...(existingCustomer ? { data: { customer: existingCustomer } } : {}) });
      }
      logTransactionFailure({ requestId: getRequestId(request), operation: "patch_customer", code: "customer_update_failed", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_update_failed" });
    }
    if (!data) return result(404, { ok: false, code: "not_found" });
    const customer = mapCustomer(data, await loadPrimaryAddress(supabase, administrator.organizationId, parsedId.data));
    if (!customer) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "patch_customer", code: "customer_update_contract_invalid", actorId: administrator.userId, status: 500 });
      return result(500, { ok: false, code: "customer_update_contract_invalid" });
    }
    return result(200, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return errorResponse(error, request, "patch_customer");
  }
}
