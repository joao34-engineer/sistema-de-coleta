import "server-only";

import { z } from "zod";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import type { CustomerAddressDTO, CustomerDTO } from "../model/customer";

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

export type PhaseOneClient = Readonly<{
  from(table: "customers" | "customer_addresses"): Query;
  rpc(functionName: "create_customer_with_address", args: Readonly<Record<string, unknown>>): Promise<DatabaseResponse>;
}>;

export const customerColumns = "id,legal_name,tax_id,phone,created_at,updated_at";
export const addressColumns = "id,customer_id,label,street,street_number,address_complement,district,city,state_code,postal_code,is_primary,created_at,updated_at";

const customerRowSchema = z.object({
  id: z.string().uuid(),
  legal_name: z.string(),
  tax_id: z.string().regex(/^\d{11}$|^\d{14}$/),
  phone: z.string().regex(/^\d{10,11}$/),
  created_at: z.string(),
  updated_at: z.string(),
});

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

export async function createPhaseOneClient(): Promise<PhaseOneClient> {
  return (await createServerSupabaseClient()) as unknown as PhaseOneClient;
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

export function mapCustomer(row: unknown, address: CustomerAddressDTO | null = null): CustomerDTO | null {
  const parsed = customerRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    displayName: parsed.data.legal_name,
    taxId: parsed.data.tax_id,
    phone: parsed.data.phone,
    address,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  };
}

export async function loadPrimaryCustomerAddress(
  supabase: PhaseOneClient,
  organizationId: number,
  customerId: string,
): Promise<CustomerAddressDTO | null> {
  const { data, error } = await supabase
    .from("customer_addresses")
    .select(addressColumns)
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_primary", true)
    .maybeSingle();
  return error ? null : mapCustomerAddress(data);
}

export async function findCustomerByTaxId(
  supabase: PhaseOneClient,
  organizationId: number,
  taxId: string,
): Promise<CustomerDTO | null> {
  const existing = await supabase
    .from("customers")
    .select(customerColumns)
    .eq("organization_id", organizationId)
    .eq("tax_id", taxId)
    .maybeSingle();
  if (existing.error) return null;
  return mapCustomer(existing.data);
}

function propertyString(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || !(property in value)) return null;
  const candidate = value[property as keyof typeof value];
  return typeof candidate === "string" ? candidate : null;
}

export function objectProperty(value: unknown, property: string): unknown {
  return typeof value === "object" && value !== null && property in value ? value[property as keyof typeof value] : undefined;
}

export function errorCode(error: unknown): string | null {
  return propertyString(error, "code");
}

export function isUniqueViolation(error: unknown): boolean {
  if (propertyString(error, "code") !== "23505") return false;
  const text = `${propertyString(error, "constraint") ?? ""} ${propertyString(error, "message") ?? ""} ${propertyString(error, "details") ?? ""}`.toLowerCase();
  return text.includes("tax_id") || text.includes("customers_organization_id_tax_id_key") || text.length === 0;
}

export function isPrimaryAddressViolation(error: unknown): boolean {
  if (propertyString(error, "code") !== "23505") return false;
  const text = `${propertyString(error, "constraint") ?? ""} ${propertyString(error, "message") ?? ""} ${propertyString(error, "details") ?? ""}`.toLowerCase();
  return text.includes("customer_addresses_primary") || text.includes("is_primary");
}

function uuidProperty(value: unknown, property: string): string | null {
  const candidate = objectProperty(value, property);
  return typeof candidate === "string" && z.string().uuid().safeParse(candidate).success ? candidate : null;
}

export function customerIdFromCreation(value: unknown): string | null {
  return uuidProperty(value, "customerId") ?? uuidProperty(value, "id") ?? uuidProperty(objectProperty(value, "customer"), "id");
}
