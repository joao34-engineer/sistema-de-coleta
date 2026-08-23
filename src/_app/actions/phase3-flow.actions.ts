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
import {
  workshopCheckIn,
  saveTechnicalBudget,
  budgetApproval,
  serviceProgress,
  registerInvoiceReference,
  deliverToCustomer,
  cancelOrReopenCollection,
} from "@/_pages/collection-operations/api/commands";

type ActionSuccess<T> = Readonly<{ ok: true; data: T; rowVersion: number }>;
type ActionFailure = Readonly<{ ok: false; error: string }>;

const failureMessages: Readonly<Record<string, string>> = {
  authentication_required: "Sessão expirada. Entre novamente para continuar.",
  administrator_access_denied: "Você não tem permissão para esta operação.",
  stale_version: "A coleta foi atualizada por outra operação. Recarregue a página e revise os dados.",
  idempotency_conflict: "Esta operação já foi enviada com outros dados. Atualize a página antes de tentar de novo.",
  workshop_checkin_not_collected: "A coleta precisa estar no status 'coletada' para o check-in de oficina.",
  budget_not_in_workshop: "A coleta precisa estar 'em oficina' para registrar o orçamento.",
  budget_not_in_budget: "A coleta precisa estar 'em orçamento' para aprovar ou rejeitar.",
  service_order_not_in_service: "A coleta precisa estar 'aprovada' ou 'em reparo' para atualizar o progresso.",
  invoice_not_ready: "A coleta precisa estar 'pronta' para registrar a NF-e.",
  delivery_not_invoiced: "A coleta precisa estar 'faturada' ou em entrega parcial para entregar ao cliente.",
  collection_cannot_be_canceled: "A coleta não pode ser cancelada no status atual.",
  collection_not_canceled: "A coleta não está cancelada para ser reaberta.",
  validation_error: "Revise os dados informados e tente novamente.",
};

function toActionError(error: unknown): ActionFailure {
  if (error instanceof Error) {
    const mapped = failureMessages[error.message];
    if (mapped) return { ok: false, error: mapped };
    const supabaseCode = (error as Readonly<{ code?: string }>).code;
    if (supabaseCode && failureMessages[supabaseCode]) return { ok: false, error: failureMessages[supabaseCode] ?? "Não foi possível concluir a operação." };
    if (error.message === "invalid_signature_file") return { ok: false, error: "A assinatura enviada não é um PNG válido." };
  }
  const code = (error as Readonly<{ code?: unknown }>).code;
  if (typeof code === "string") {
    const mapped = failureMessages[code];
    if (mapped) return { ok: false, error: mapped };
    if (code === "P0001") return { ok: false, error: "A coleta não atende aos requisitos desta operação." };
    if (code === "40001") return { ok: false, error: failureMessages["stale_version"] ?? "Recarregue a página e tente novamente." };
  }
  return { ok: false, error: "Não foi possível concluir a operação. Verifique a conexão e tente novamente." };
}

function revalidateDetail(collectionId: string): void {
  revalidatePath(`/coletas/${collectionId}`);
}

function parseJsonItems(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
      items: parseJsonItems(formData.get("items")),
      signatureIntentId: formData.get("signatureIntentId"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? failureMessages["validation_error"] ?? "Revise os dados informados." };
    }
    const data = await workshopCheckIn(collectionId, parsed.data as WorkshopCheckInDTO, signatureFile);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toActionError(error);
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
    return toActionError(error);
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
    return toActionError(error);
  }
}

export type UpdateServiceProgressActionResult =
  | ActionSuccess<{ status: "approved" | "in_service" | "ready" }>
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
    return toActionError(error);
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
    return toActionError(error);
  }
}

export type DeliverToCustomerActionResult =
  | ActionSuccess<{ status: "partial_delivery" | "delivered" }>
  | ActionFailure;

export async function deliverToCustomerAction(collectionId: string, formData: FormData): Promise<DeliverToCustomerActionResult> {
  try {
    const signatureFile = formData.get("signature");
    if (!(signatureFile instanceof File)) {
      return { ok: false, error: "Desenhe a assinatura antes de confirmar." };
    }
    const deliveredItemIds = parseJsonItems(formData.get("deliveredItemIds"));
    const parsed = customerDeliverySchema.safeParse({
      collectionId,
      expectedVersion: Number(formData.get("expectedVersion")),
      deliveredItemIds,
      receiverName: formData.get("receiverName"),
      receiverTaxId: formData.get("receiverTaxId"),
      notes: formData.get("notes") || undefined,
      signatureIntentId: formData.get("signatureIntentId"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados da entrega." };
    }
    const data = await deliverToCustomer(collectionId, parsed.data as CustomerDeliveryDTO, signatureFile);
    revalidateDetail(collectionId);
    return { ok: true, data: { status: data.status }, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return toActionError(error);
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
    return toActionError(error);
  }
}
