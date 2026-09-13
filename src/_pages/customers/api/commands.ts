import "server-only";

import { requireAuthenticatedAdministrator, type AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { attachActorId } from "@/shared/lib/server-logger";
import type {
  CustomerAddressDTO,
  CustomerAddressInput,
  CustomerAddressPatch,
  CustomerDTO,
  CustomerInput,
  CustomerPatch,
} from "../model/customer";
import {
  addressColumns,
  createPhaseOneClient,
  customerColumns,
  customerIdFromCreation,
  findCustomerByTaxId,
  isPrimaryAddressViolation,
  isUniqueViolation,
  loadPrimaryCustomerAddress,
  mapCustomer,
  mapCustomerAddress,
  type PhaseOneClient,
} from "./customer-db";

export class DuplicateTaxIdError extends Error {
  readonly customer: CustomerDTO | null;

  constructor(customer: CustomerDTO | null) {
    super("duplicate_tax_id");
    this.name = "DuplicateTaxIdError";
    this.customer = customer;
  }
}

function fail(code: string, actorId: string): never {
  throw attachActorId(new Error(code), actorId);
}

function addressRpcPayload(input: NonNullable<CustomerInput["address"]>): Record<string, unknown> {
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

export async function createCustomer(input: CustomerInput): Promise<CustomerDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase.rpc("create_customer_with_address", {
    p_legal_name: input.displayName,
    p_tax_id: input.taxId,
    p_phone: input.phone,
    p_address: input.address ? addressRpcPayload(input.address) : null,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateTaxIdError(await findCustomerByTaxId(supabase, administrator.organizationId, input.taxId));
    }
    if (isPrimaryAddressViolation(error)) {
      throw attachActorId(new Error("primary_address_conflict"), administrator.userId);
    }
    fail("customer_create_failed", administrator.userId);
  }
  const customerId = customerIdFromCreation(data);
  if (!customerId) fail("customer_create_contract_invalid", administrator.userId);
  const customerRecord = await supabase
    .from("customers")
    .select(customerColumns)
    .eq("organization_id", administrator.organizationId)
    .eq("id", customerId)
    .maybeSingle();
  if (customerRecord.error) fail("customer_create_readback_failed", administrator.userId);
  const customer = mapCustomer(customerRecord.data, await loadPrimaryCustomerAddress(supabase, administrator.organizationId, customerId));
  if (!customer) fail("customer_create_contract_invalid", administrator.userId);
  return customer;
}

export async function patchCustomer(id: string, input: CustomerPatch): Promise<CustomerDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  const values = {
    ...(input.displayName === undefined ? {} : { legal_name: input.displayName }),
    ...(input.taxId === undefined ? {} : { tax_id: input.taxId }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    updated_by: administrator.userId,
  };
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase
    .from("customers")
    .update(values)
    .eq("organization_id", administrator.organizationId)
    .eq("id", id)
    .eq("status", "active")
    .select(customerColumns)
    .maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateTaxIdError(input.taxId ? await findCustomerByTaxId(supabase, administrator.organizationId, input.taxId) : null);
    }
    fail("customer_update_failed", administrator.userId);
  }
  if (!data) throw attachActorId(new Error("not_found"), administrator.userId);
  const customer = mapCustomer(data, await loadPrimaryCustomerAddress(supabase, administrator.organizationId, id));
  if (!customer) fail("customer_update_contract_invalid", administrator.userId);
  return customer;
}

async function insertCustomerAddressRecord(
  supabase: PhaseOneClient,
  administrator: AuthenticatedAdministrator,
  customerId: string,
  input: CustomerAddressInput,
): Promise<Readonly<{ address: CustomerAddressDTO | null; error: unknown }>> {
  const { data, error } = await supabase
    .from("customer_addresses")
    .insert(addressValues(input, administrator, customerId))
    .select(addressColumns)
    .maybeSingle();
  return { address: mapCustomerAddress(data), error };
}

export async function createCustomerAddress(customerId: string, input: CustomerAddressInput): Promise<CustomerAddressDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const customer = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", administrator.organizationId)
    .eq("id", customerId)
    .maybeSingle();
  if (customer.error) fail("customer_query_failed", administrator.userId);
  if (!customer.data) throw attachActorId(new Error("not_found"), administrator.userId);
  const inserted = await insertCustomerAddressRecord(supabase, administrator, customerId, input);
  if (inserted.error || !inserted.address) {
    if (isPrimaryAddressViolation(inserted.error)) {
      throw attachActorId(new Error("primary_address_conflict"), administrator.userId);
    }
    fail("customer_address_create_failed", administrator.userId);
  }
  return inserted.address;
}

export async function patchCustomerAddress(
  customerId: string,
  addressId: string,
  input: CustomerAddressPatch,
): Promise<CustomerAddressDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  const values: Record<string, unknown> = {
    ...(input.label === undefined ? {} : { label: input.label }),
    ...(input.street === undefined ? {} : { street: input.street }),
    ...(input.streetNumber === undefined ? {} : { street_number: input.streetNumber }),
    ...(input.complement === undefined ? {} : { address_complement: input.complement }),
    ...(input.district === undefined ? {} : { district: input.district }),
    ...(input.city === undefined ? {} : { city: input.city }),
    ...(input.stateCode === undefined ? {} : { state_code: input.stateCode }),
    ...(input.postalCode === undefined ? {} : { postal_code: input.postalCode }),
    ...(input.isPrimary === undefined ? {} : { is_primary: input.isPrimary }),
  };
  const supabase = await createPhaseOneClient();
  const { data, error } = await supabase
    .from("customer_addresses")
    .update(values)
    .eq("organization_id", administrator.organizationId)
    .eq("customer_id", customerId)
    .eq("id", addressId)
    .select(addressColumns)
    .maybeSingle();
  if (error) {
    if (isPrimaryAddressViolation(error)) {
      throw attachActorId(new Error("primary_address_conflict"), administrator.userId);
    }
    fail("customer_address_update_failed", administrator.userId);
  }
  const address = mapCustomerAddress(data);
  if (!address) throw attachActorId(new Error("not_found"), administrator.userId);
  return address;
}
