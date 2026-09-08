"use server";

import { revalidatePath } from "next/cache";
import {
  workshopCheckInSchema,
  technicalBudgetSchema,
  budgetApprovalSchema,
  serviceProgressSchema,
  invoiceReferenceSchema,
  customerDeliverySchema,
  cancelReopenSchema,
  type WorkshopCheckInDTO,
  type TechnicalBudgetDTO,
  type BudgetApprovalDTO,
  type ServiceProgressDTO,
  type InvoiceReferenceDTO,
  type CustomerDeliveryDTO,
  type CancelReopenDTO,
} from "@/_pages/collection-operations/model/contracts";
import { parseJsonFormField, customerDeliveryFormValues } from "@/_pages/collection-operations/model/workshop-rpc-items";
import {
  workshopCheckIn,
  saveTechnicalBudget,
  budgetApproval,
  serviceProgress,
  registerInvoiceReference,
  deliverToCustomer,
  cancelOrReopenCollection,
} from "@/_pages/collection-operations/api/commands";

import { toSafeActionError } from "@/shared/lib/action-error";

type ActionSuccess<T> = Readonly<{ ok: true; data: T; rowVersion: number }>;
type ActionFailure = Readonly<{ ok: false; error: string }>;

function revalidateDetail(collectionId: string): void {
  revalidatePath(`/coletas/${collectionId}`);
}

export type WorkshopCheckInActionResult =
  | ActionSuccess<{ status: "in_workshop" }>
  | ActionFailure;

export async function workshopCheckInAction(collectionId: string, formData: FormData): Promise<WorkshopCheckInActionResult> {
  try {
    const signatureFile = formData.get("signature");
    if (!(signatureFile instanceof File)) {
      return { ok: false, error: "Desenhe a assinatura antes de confirmar." };
    }
    const parsed = workshopCheckInSchema.safeParse({
      collectionId,
      expectedVersion: Number(formData.get("expectedVersion")),
      administratorName: formData.get("administratorName"),
      administratorTaxId: formData.get("administratorTaxId"),
      items: parseJsonFormField(formData.get("items")),
      signatureIntentId: formData.get("signatureIntentId"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };
    }
    const data = await workshopCheckIn(collectionId, parsed.data as WorkshopCheckInDTO, signatureFile);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type SaveTechnicalBudgetActionResult =
  | ActionSuccess<{ status: "in_budget" }>
  | ActionFailure;

export async function saveTechnicalBudgetAction(collectionId: string, input: TechnicalBudgetDTO, idempotencyKey: string): Promise<SaveTechnicalBudgetActionResult> {
  try {
    const parsed = technicalBudgetSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados do orçamento." };
    }
    const data = await saveTechnicalBudget(collectionId, parsed.data, idempotencyKey);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type ApproveBudgetActionResult =
  | ActionSuccess<{ status: "approved" | "rejected" }>
  | ActionFailure;

export async function approveBudgetAction(collectionId: string, input: BudgetApprovalDTO, idempotencyKey: string): Promise<ApproveBudgetActionResult> {
  try {
    const parsed = budgetApprovalSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados da aprovação." };
    }
    const data = await budgetApproval(collectionId, parsed.data, idempotencyKey);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type UpdateServiceProgressActionResult =
  | ActionSuccess<{ status: "approved" | "in_service" | "ready" | "partial_delivery" | "invoiced" }>
  | ActionFailure;

export async function updateServiceProgressAction(collectionId: string, input: ServiceProgressDTO, idempotencyKey: string): Promise<UpdateServiceProgressActionResult> {
  try {
    const parsed = serviceProgressSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados de progresso." };
    }
    const data = await serviceProgress(collectionId, parsed.data, idempotencyKey);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type RegisterInvoiceReferenceActionResult =
  | ActionSuccess<{ status: "invoiced" }>
  | ActionFailure;

export async function registerInvoiceReferenceAction(collectionId: string, input: InvoiceReferenceDTO, idempotencyKey: string): Promise<RegisterInvoiceReferenceActionResult> {
  try {
    const parsed = invoiceReferenceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados da NF-e." };
    }
    const data = await registerInvoiceReference(collectionId, parsed.data, idempotencyKey);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type DeliverToCustomerActionResult =
  | ActionSuccess<{ status: "partial_delivery" | "delivered" | "invoiced" }>
  | ActionFailure;

export async function deliverToCustomerAction(collectionId: string, formData: FormData): Promise<DeliverToCustomerActionResult> {
  try {
    const signatureFile = formData.get("signature");
    if (!(signatureFile instanceof File)) {
      return { ok: false, error: "Desenhe a assinatura antes de confirmar." };
    }
    const parsed = customerDeliverySchema.safeParse(customerDeliveryFormValues(collectionId, formData));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados da entrega." };
    }
    const data = await deliverToCustomer(collectionId, parsed.data as CustomerDeliveryDTO, signatureFile);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export type CancelReopenActionResult =
  | ActionSuccess<{ status: string }>
  | ActionFailure;

export async function cancelOrReopenCollectionAction(collectionId: string, input: CancelReopenDTO, idempotencyKey: string): Promise<CancelReopenActionResult> {
  try {
    const parsed = cancelReopenSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Informe uma justificativa válida." };
    }
    const data = await cancelOrReopenCollection(collectionId, parsed.data, idempotencyKey);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}
