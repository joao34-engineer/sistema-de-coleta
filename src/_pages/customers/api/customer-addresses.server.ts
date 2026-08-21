import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AdministratorAccessDeniedError,
  AuthenticationRequiredError,
  requireAuthenticatedAdministrator,
  type AuthenticatedAdministrator,
} from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import {
  customerAddressInputSchema,
  customerAddressPatchSchema,
  customerIdSchema,
  type CustomerAddressDTO,
  type CustomerAddressInput,
} from "../model/customer";

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
export type CustomerAddressQuery = PromiseLike<DatabaseResponse> & {
  select(columns: string): CustomerAddressQuery;
  insert(values: unknown): CustomerAddressQuery;
  update(values: unknown): CustomerAddressQuery;
  eq(column: string, value: unknown): CustomerAddressQuery;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): CustomerAddressQuery;
  maybeSingle(): CustomerAddressQuery;
};

export type CustomerAddressClient = Readonly<{
  from(table: "customers" | "customer_addresses"): CustomerAddressQuery;
}>;

const addressColumns = "id,customer_id,label,street,street_number,address_complement,district,city,state_code,postal_code,is_primary,created_at,updated_at";
const addressRowSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  label: z.string().nullable(),
  street: z.string(),
  street_number: z.string().nullable(),
  address_complement: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string(),
  state_code: z.string().regex(/^[A-Z]{2}$/),
  postal_code: z.string().regex(/^\d{8}$/).nullable(),
  is_primary: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

function respond(status: number, body: unknown): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = error.code;
  return typeof code === "string" ? code : null;
}

function isPrimaryAddressViolation(error: unknown): boolean {
  if (errorCode(error) !== "23505") return false;
  if (typeof error !== "object" || error === null) return false;
  const read = (property: string): string => {
    const value = property in error ? error[property as keyof typeof error] : undefined;
    return typeof value === "string" ? value : "";
  };
  return `${read("constraint")} ${read("message")} ${read("details")}`.toLowerCase().includes("customer_addresses_primary");
}

function errorResponse(error: unknown, request: Request, operation: string): NextResponse {
  if (error instanceof AuthenticationRequiredError) return respond(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return respond(403, { ok: false, code: "forbidden" });
  logTransactionFailure({ requestId: getRequestId(request), operation, code: "customer_address_unexpected_error", actorId: null, status: 500 });
  return respond(500, { ok: false, code: "unexpected_error" });
}

export function mapCustomerAddress(value: unknown): CustomerAddressDTO | null {
  const parsed = addressRowSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    customerId: parsed.data.customer_id,
    label: parsed.data.label,
    street: parsed.data.street,
    streetNumber: parsed.data.street_number,
    complement: parsed.data.address_complement,
    district: parsed.data.district,
    city: parsed.data.city,
    stateCode: parsed.data.state_code,
    postalCode: parsed.data.postal_code,
    isPrimary: parsed.data.is_primary,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  };
}

export async function loadPrimaryCustomerAddress(supabase: CustomerAddressClient, organizationId: number, customerId: string): Promise<CustomerAddressDTO | null> {
  const { data, error } = await supabase.from("customer_addresses").select(addressColumns).eq("organization_id", organizationId).eq("customer_id", customerId).eq("is_primary", true).maybeSingle();
  return error ? null : mapCustomerAddress(data);
}

function addressValues(input: CustomerAddressInput, administrator: AuthenticatedAdministrator, customerId: string): Record<string, unknown> {
  return {
    organization_id: administrator.organizationId,
    customer_id: customerId,
    label: input.label ?? null,
    street: input.street,
    street_number: input.streetNumber ?? null,
    address_complement: input.complement ?? null,
    district: input.district ?? null,
    city: input.city,
    state_code: input.stateCode,
    postal_code: input.postalCode ?? null,
    is_primary: input.isPrimary,
    created_by: administrator.userId,
  };
}

export async function insertCustomerAddressRecord(
  supabase: CustomerAddressClient,
  administrator: AuthenticatedAdministrator,
  customerId: string,
  input: CustomerAddressInput,
): Promise<Readonly<{ address: CustomerAddressDTO | null; error: unknown }>> {
  const { data, error } = await supabase.from("customer_addresses").insert(addressValues(input, administrator, customerId)).select(addressColumns).maybeSingle();
  return { address: mapCustomerAddress(data), error };
}

export async function createCustomerAddress(request: Request, customerId: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(customerId);
    const input = customerAddressInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const supabase = (await createServerSupabaseClient()) as unknown as CustomerAddressClient;
    const customer = await supabase.from("customers").select("id").eq("organization_id", administrator.organizationId).eq("id", parsedId.data).maybeSingle();
    if (customer.error) {
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer_address", code: "customer_query_failed", actorId: administrator.userId, status: 500 });
      return respond(500, { ok: false, code: "customer_query_failed" });
    }
    if (!customer.data) return respond(404, { ok: false, code: "not_found" });
    const inserted = await insertCustomerAddressRecord(supabase, administrator, parsedId.data, input.data);
    if (inserted.error || !inserted.address) {
      if (isPrimaryAddressViolation(inserted.error)) return respond(409, { ok: false, code: "primary_address_conflict" });
      logTransactionFailure({ requestId: getRequestId(request), operation: "create_customer_address", code: errorCode(inserted.error) ?? "customer_address_create_failed", actorId: administrator.userId, status: 500 });
      return respond(500, { ok: false, code: "customer_address_create_failed" });
    }
    return respond(201, { ok: true, data: { address: inserted.address } });
  } catch (error: unknown) {
    return errorResponse(error, request, "create_customer_address");
  }
}

export async function patchCustomerAddress(request: Request, customerId: string, addressId: string): Promise<NextResponse> {
  try {
    const parsedCustomerId = customerIdSchema.safeParse(customerId);
    const parsedAddressId = customerIdSchema.safeParse(addressId);
    const input = customerAddressPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsedCustomerId.success || !parsedAddressId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const administrator = await requireAuthenticatedAdministrator();
    const values: Record<string, unknown> = {
      ...(input.data.label === undefined ? {} : { label: input.data.label }),
      ...(input.data.street === undefined ? {} : { street: input.data.street }),
      ...(input.data.streetNumber === undefined ? {} : { street_number: input.data.streetNumber }),
      ...(input.data.complement === undefined ? {} : { address_complement: input.data.complement }),
      ...(input.data.district === undefined ? {} : { district: input.data.district }),
      ...(input.data.city === undefined ? {} : { city: input.data.city }),
      ...(input.data.stateCode === undefined ? {} : { state_code: input.data.stateCode }),
      ...(input.data.postalCode === undefined ? {} : { postal_code: input.data.postalCode }),
      ...(input.data.isPrimary === undefined ? {} : { is_primary: input.data.isPrimary }),
    };
    const supabase = (await createServerSupabaseClient()) as unknown as CustomerAddressClient;
    const { data, error } = await supabase.from("customer_addresses").update(values).eq("organization_id", administrator.organizationId).eq("customer_id", parsedCustomerId.data).eq("id", parsedAddressId.data).select(addressColumns).maybeSingle();
    if (error) {
      if (isPrimaryAddressViolation(error)) return respond(409, { ok: false, code: "primary_address_conflict" });
      logTransactionFailure({ requestId: getRequestId(request), operation: "patch_customer_address", code: errorCode(error) ?? "customer_address_update_failed", actorId: administrator.userId, status: 500 });
      return respond(500, { ok: false, code: "customer_address_update_failed" });
    }
    const address = mapCustomerAddress(data);
    if (!address) return respond(404, { ok: false, code: "not_found" });
    return respond(200, { ok: true, data: { address } });
  } catch (error: unknown) {
    return errorResponse(error, request, "patch_customer_address");
  }
}
