import "server-only";

import { z } from "zod";
import { createOperationsSupabaseClient } from "./operations-supabase";

const uuidSchema = z.uuid();

const snakeToCamel = (str: string): string => str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

function normalizeOperationsPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeOperationsPayload);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    Object.entries(record).map(([key, nested]) => [snakeToCamel(key), normalizeOperationsPayload(nested)])
  );
}

export const serviceOrderSchema = z.object({
  id: uuidSchema,
  organizationId: z.number().int().positive(),
  collectionId: uuidSchema,
  administratorId: uuidSchema,
  laborBrl: z.number(),
  partsBrl: z.number(),
  dueDays: z.number().int().positive(),
  status: z.enum(["draft", "budgeted", "approved", "in_service", "ready", "canceled", "rejected", "delivered"]),
  approvalSignerName: z.string().nullable(),
  approvalSignerTaxId: z.string().nullable(),
  checkInSignaturePath: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const budgetItemSchema = z.object({
  id: uuidSchema,
  collectionItemId: uuidSchema,
  laborCostBrl: z.number(),
  partsCostBrl: z.number(),
  estimatedDays: z.number().int().positive(),
  status: z.enum(["em_reparo", "pronto"]).nullable(),
  notes: z.string().nullable(),
});

export const deliveryTermSchema = z.object({
  id: uuidSchema,
  organizationId: z.number().int().positive(),
  collectionId: uuidSchema,
  serviceOrderId: uuidSchema.nullable(),
  receiverName: z.string(),
  receiverTaxId: z.string(),
  signaturePath: z.string(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const deliveryTermItemSchema = z.object({
  id: uuidSchema,
  deliveryTermId: uuidSchema,
  collectionItemId: uuidSchema,
  quantity: z.number().positive(),
});

export const invoiceReferenceViewSchema = z.object({
  id: uuidSchema,
  organizationId: z.number().int().positive(),
  collectionId: uuidSchema,
  number: z.string(),
  series: z.string(),
  issuedAt: z.iso.datetime({ offset: true }),
  totalBrl: z.number().positive(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export async function getServiceOrder(collectionId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("service_orders")
    .select("*")
    .eq("collection_id", collectionId)
    .maybeSingle();
  if (error) throw error;
  return serviceOrderSchema.safeParse(normalizeOperationsPayload(data)).data ?? null;
}

export async function getBudgetItems(collectionId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("service_order_items")
    .select("*")
    .eq("collection_id", collectionId);
  if (error) throw error;
  return z.array(budgetItemSchema).safeParse(normalizeOperationsPayload(data)).data ?? [];
}

export async function getDeliveryTerms(collectionId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_terms")
    .select("*")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return z.array(deliveryTermSchema).safeParse(normalizeOperationsPayload(data)).data ?? [];
}

export async function getDeliveryTermItems(deliveryTermId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_term_items")
    .select("*")
    .eq("delivery_term_id", deliveryTermId);
  if (error) throw error;
  return z.array(deliveryTermItemSchema).safeParse(normalizeOperationsPayload(data)).data ?? [];
}

export async function getInvoiceReference(collectionId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("invoice_references")
    .select("*")
    .eq("collection_id", collectionId)
    .order("issued_at", { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return invoiceReferenceViewSchema.safeParse(normalizeOperationsPayload(data)).data ?? null;
}

export async function getWorkshopCheckInItems(collectionId: string) {
  const supabase = await createOperationsSupabaseClient();
  const { data, error } = await supabase
    .from("workshop_checkin_items")
    .select("*")
    .eq("collection_id", collectionId);
  if (error) throw error;
  return z
    .array(
      z.object({
        id: uuidSchema,
        collectionItemId: uuidSchema,
        quantityObserved: z.number().positive(),
        conditionObserved: z.string(),
        divergenceNotes: z.string().nullable(),
      })
    )
    .safeParse(normalizeOperationsPayload(data)).data ?? [];
}
