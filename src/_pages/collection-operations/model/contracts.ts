import { z } from "zod";
import { isValidCnpj, normalizeDigits } from "@/shared/lib/cnpj";

const uuidSchema = z.string().uuid();

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (base: string, factor: number): number => {
    const sum = [...base].reduce((total, character, index) => total + Number(character) * (factor - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(value.slice(0, 9), 10) === Number(value[9]) && digit(value.slice(0, 10), 11) === Number(value[10]);
}

export const taxIdSchema = z
  .string()
  .trim()
  .transform(normalizeDigits)
  .refine((value) => isValidCpf(value) || isValidCnpj(value), "Informe um CPF ou CNPJ válido.");

// 1. Workshop Entry Check-In (O02)
export const workshopCheckInItemSchema = z.object({
  itemId: uuidSchema,
  itemDescription: z.string().min(1),
  quantityObserved: z.number().positive(),
  conditionObserved: z.string().min(1, "Informe a condição observada."),
  divergenceNotes: z.string().max(1000).nullable().optional(),
});

export const workshopCheckInSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  administratorName: z.string().trim().min(2, "Informe o nome do administrador responsavel.").max(160),
  administratorTaxId: taxIdSchema,
  items: z.array(workshopCheckInItemSchema).min(1, "Confira ao menos um item."),
  signatureIntentId: uuidSchema,
});

// 2. Technical Budget (O03)
export const technicalBudgetItemSchema = z.object({
  itemId: uuidSchema,
  itemDescription: z.string(),
  laborCostBrl: z.number().min(0, "Valor invalido."),
  partsCostBrl: z.number().min(0, "Valor invalido."),
  estimatedDays: z.number().int().min(1, "Prazo minimo de 1 dia."),
  notes: z.string().max(1000).nullable().optional(),
});

export const technicalBudgetSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  items: z.array(technicalBudgetItemSchema).min(1, "Ao menos um item no orcamento."),
  generalNotes: z.string().max(2000).nullable().optional(),
}).refine(
  (data) => new Set(data.items.map((item) => item.itemId)).size === data.items.length,
  { message: "O mesmo item não pode ser informado mais de uma vez.", path: ["items"] },
);

// 3. Budget Approval (M13)
export const budgetApprovalSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  approved: z.boolean(),
  rejectionReason: z.string().trim().max(1000).optional(),
  signerName: z.string().trim().min(2, "Informe o nome do responsavel.").max(160),
  signerTaxId: taxIdSchema,
  signature: z.string().optional(),
}).refine(
  (data) => data.approved || (data.rejectionReason && data.rejectionReason.length >= 5),
  { message: "Justificativa obrigatória em caso de não aprovação (mínimo 5 caracteres).", path: ["rejectionReason"] }
);

// 4. Service Maintenance Tracking (M14)
export const serviceProgressItemSchema = z.object({
  itemId: uuidSchema,
  itemDescription: z.string(),
  status: z.enum(["em_reparo", "pronto"]),
  notes: z.string().max(1000).nullable().optional(),
});

export const serviceProgressSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  items: z.array(serviceProgressItemSchema).min(1),
});

// 5. Invoice Reference Manual Input (M15)
export const invoiceReferenceSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  number: z.string().trim().min(1, "Informe o numero da NF-e.").max(32),
  series: z.string().trim().min(1, "Informe a serie da NF-e.").max(10),
  issuedAt: z.string().min(1, "Informe a data de emissao."),
  totalBrl: z.number().positive("O valor total da nota deve ser maior que zero."),
  notes: z.string().trim().max(1000).optional(),
});

// 6. Customer Delivery (O04)
export const customerDeliverySchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  deliveredItemIds: z
    .array(uuidSchema)
    .min(1, "Selecione ao menos um item para entrega.")
    .refine((ids) => new Set(ids).size === ids.length, "O mesmo item não pode ser informado mais de uma vez."),
  receiverName: z.string().trim().min(2, "Informe o nome de quem recebeu os equipamentos.").max(160),
  receiverTaxId: taxIdSchema,
  notes: z.string().trim().max(1000).optional(),
  signatureIntentId: uuidSchema,
});

// 7. Cancel / Reopen Audit (O05)
export const cancelReopenSchema = z.object({
  collectionId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  action: z.enum(["cancel", "reopen"]),
  reason: z.string().trim().min(5, "Informe uma justificativa valida de no minimo 5 caracteres.").max(1000),
});

export type WorkshopCheckInDTO = z.infer<typeof workshopCheckInSchema>;
export type TechnicalBudgetDTO = z.infer<typeof technicalBudgetSchema>;
export type BudgetApprovalDTO = z.infer<typeof budgetApprovalSchema>;
export type ServiceProgressDTO = z.infer<typeof serviceProgressSchema>;
export type InvoiceReferenceDTO = z.infer<typeof invoiceReferenceSchema>;
export type CustomerDeliveryDTO = z.infer<typeof customerDeliverySchema>;
export type CancelReopenDTO = z.infer<typeof cancelReopenSchema>;

// Result schemas for operations commands
export const workshopCheckInResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.literal("in_workshop"),
  rowVersion: z.number().int().positive(),
  administratorName: z.string(),
});

export const technicalBudgetResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.literal("in_budget"),
  rowVersion: z.number().int().positive(),
  serviceOrderId: uuidSchema,
});

export const budgetApprovalResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.enum(["approved", "rejected"]),
  rowVersion: z.number().int().positive(),
  serviceOrderId: uuidSchema,
});

export const serviceProgressResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.enum(["approved", "in_service", "ready", "partial_delivery", "invoiced"]),
  rowVersion: z.number().int().positive(),
  serviceOrderId: uuidSchema,
});

export type ServiceProgressResult = z.infer<typeof serviceProgressResultSchema>;
export type ServiceProgressResultStatus = ServiceProgressResult["status"];

export const invoiceReferenceResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.literal("invoiced"),
  rowVersion: z.number().int().positive(),
  invoiceId: uuidSchema,
});

export const customerDeliveryResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.enum(["partial_delivery", "delivered", "invoiced"]),
  rowVersion: z.number().int().positive(),
  delivered: z.boolean(),
  partial: z.boolean(),
  deliveryTermId: uuidSchema,
});

export const cancelReopenResultSchema = z.object({
  collectionId: uuidSchema,
  status: z.enum([
    "canceled",
    "collected",
    "in_workshop",
    "in_budget",
    "awaiting_approval",
    "approved",
    "in_service",
    "ready",
    "invoiced",
    "partial_delivery",
    "delivered",
    "rejected",
    "reopened",
  ]),
  rowVersion: z.number().int().positive(),
});
