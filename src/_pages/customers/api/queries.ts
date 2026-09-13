import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { attachActorId } from "@/shared/lib/server-logger";
import { customerIdSchema, type CustomerDTO, type CustomerListQuery } from "../model/customer";
import {
  createPhaseOneClient,
  customerColumns,
  loadPrimaryCustomerAddress,
  mapCustomer,
} from "./customer-db";

export type CustomerListPage = Readonly<{
  customers: CustomerDTO[];
  nextCursor: string | null;
}>;

export type LoadCustomerResult =
  | { ok: true; customer: CustomerDTO }
  | { ok: false; reason: "invalid_id" | "not_found" | "query_failed" | "contract_invalid" };

export async function listCustomers(query: CustomerListQuery): Promise<CustomerListPage> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const normalizedSearch = query.q.replace(/[^\d]/g, "");
  let databaseQuery = supabase
    .from("customers")
    .select(customerColumns)
    .eq("organization_id", administrator.organizationId)
    .eq("status", "active")
    .order("legal_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(query.limit + 1);
  if (query.cursor) databaseQuery = databaseQuery.gt("id", query.cursor);
  if (query.q) {
    const safeText = query.q.replace(/[,%()*.]/g, "");
    const terms = [`legal_name.ilike.*${safeText}*`];
    if (normalizedSearch) terms.push(`tax_id.ilike.*${normalizedSearch}*`, `phone.ilike.*${normalizedSearch}*`);
    databaseQuery = databaseQuery.or(terms.join(","));
  }
  const { data, error } = await databaseQuery;
  if (error || !Array.isArray(data)) {
    throw attachActorId(new Error("customer_query_failed"), administrator.userId);
  }
  const customers = data.map((row) => mapCustomer(row)).filter((value): value is CustomerDTO => value !== null);
  const hasMore = customers.length > query.limit;
  const page = hasMore ? customers.slice(0, query.limit) : customers;
  return { customers: page, nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function loadCustomerDto(id: string): Promise<LoadCustomerResult> {
  const parsedId = customerIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, reason: "invalid_id" };
  }
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
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
  const customer = mapCustomer(data, await loadPrimaryCustomerAddress(supabase, administrator.organizationId, parsedId.data));
  if (!customer) {
    return { ok: false, reason: "contract_invalid" };
  }
  return { ok: true, customer };
}
