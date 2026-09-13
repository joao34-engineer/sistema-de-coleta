import "server-only";

import { NextResponse } from "next/server";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { actorIdFromUnknown, getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import {
  customerAddressInputSchema,
  customerAddressPatchSchema,
  customerIdSchema,
  customerInputSchema,
  customerPatchSchema,
  customerSearchSchema,
} from "../model/customer";
import { DuplicateTaxIdError, createCustomer as createCustomerCommand, createCustomerAddress as createCustomerAddressCommand, patchCustomer as patchCustomerCommand, patchCustomerAddress as patchCustomerAddressCommand } from "./commands";
import { listCustomers as listCustomersQuery, loadCustomerDto } from "./queries";

const SERVER_FAILURE_CODES = new Set([
  "customer_query_failed",
  "customer_query_contract_invalid",
  "customer_create_failed",
  "customer_create_contract_invalid",
  "customer_create_readback_failed",
  "customer_update_failed",
  "customer_update_contract_invalid",
  "customer_address_create_failed",
  "customer_address_update_failed",
]);

function respond(status: number, body: unknown): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function customerErrorResponse(error: unknown, request: Request, operation: string): NextResponse {
  if (error instanceof AuthenticationRequiredError) return respond(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return respond(403, { ok: false, code: "forbidden" });
  if (error instanceof DuplicateTaxIdError) {
    return respond(409, { ok: false, code: "duplicate_tax_id", ...(error.customer ? { data: { customer: error.customer } } : {}) });
  }
  if (error instanceof Error && error.message === "primary_address_conflict") {
    return respond(409, { ok: false, code: "primary_address_conflict" });
  }
  if (error instanceof Error && error.message === "not_found") {
    return respond(404, { ok: false, code: "not_found" });
  }
  if (error instanceof Error && error.message === "validation_error") {
    return respond(400, { ok: false, code: "validation_error" });
  }
  if (error instanceof Error && SERVER_FAILURE_CODES.has(error.message)) {
    logTransactionFailure({
      requestId: getRequestId(request),
      operation,
      code: error.message,
      actorId: actorIdFromUnknown(error),
      status: 500,
    });
    return respond(500, { ok: false, code: error.message });
  }
  logTransactionFailure({
    requestId: getRequestId(request),
    operation,
    code: operation.includes("address") ? "customer_address_unexpected_error" : "customer_unexpected_error",
    actorId: actorIdFromUnknown(error),
    status: 500,
  });
  return respond(500, { ok: false, code: "unexpected_error" });
}

export async function listCustomers(request: Request): Promise<NextResponse> {
  try {
    const query = customerSearchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return respond(400, { ok: false, code: "validation_error" });
    const data = await listCustomersQuery(query.data);
    return respond(200, { ok: true, data });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "list_customers");
  }
}

export async function createCustomer(request: Request): Promise<NextResponse> {
  try {
    const input = customerInputSchema.safeParse(await parseJson(request));
    if (!input.success) return respond(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const customer = await createCustomerCommand(input.data);
    return respond(201, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "create_customer");
  }
}

export async function getCustomer(id: string, request: Request): Promise<NextResponse> {
  try {
    const loaded = await loadCustomerDto(id);
    if (loaded.ok) {
      return respond(200, { ok: true, data: { customer: loaded.customer } });
    }
    if (loaded.reason === "invalid_id") {
      return respond(400, { ok: false, code: "validation_error" });
    }
    if (loaded.reason === "not_found") {
      return respond(404, { ok: false, code: "not_found" });
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
    return respond(500, { ok: false, code });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "get_customer");
  }
}

export async function patchCustomer(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(id);
    const input = customerPatchSchema.safeParse(await parseJson(request));
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const customer = await patchCustomerCommand(parsedId.data, input.data);
    return respond(200, { ok: true, data: { customer } });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "patch_customer");
  }
}

export async function createCustomerAddress(request: Request, customerId: string): Promise<NextResponse> {
  try {
    const parsedId = customerIdSchema.safeParse(customerId);
    const input = customerAddressInputSchema.safeParse(await parseJson(request));
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const address = await createCustomerAddressCommand(parsedId.data, input.data);
    return respond(201, { ok: true, data: { address } });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "create_customer_address");
  }
}

export async function patchCustomerAddress(request: Request, customerId: string, addressId: string): Promise<NextResponse> {
  try {
    const parsedCustomerId = customerIdSchema.safeParse(customerId);
    const parsedAddressId = customerIdSchema.safeParse(addressId);
    const input = customerAddressPatchSchema.safeParse(await parseJson(request));
    if (!parsedCustomerId.success || !parsedAddressId.success || !input.success) {
      return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    }
    const address = await patchCustomerAddressCommand(parsedCustomerId.data, parsedAddressId.data, input.data);
    return respond(200, { ok: true, data: { address } });
  } catch (error: unknown) {
    return customerErrorResponse(error, request, "patch_customer_address");
  }
}
