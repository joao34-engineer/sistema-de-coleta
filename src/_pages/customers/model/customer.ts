import { z } from "zod";
import { isValidCpfOrCnpj } from "@/shared/lib/cpf";
import { normalizeDigits } from "@/shared/lib/cnpj";
import { normalizeBrazilianPhone } from "@/shared/lib/phone";

const documentSchema = z.string().trim().transform(normalizeDigits).refine(isValidCpfOrCnpj, "Informe um CPF ou CNPJ vÃ¡lido.");
const phoneSchema = z.string().trim().transform((value, context) => {
  const phone = normalizeBrazilianPhone(value);
  if (phone === null) {
    context.addIssue({ code: "custom", message: "Informe um telefone brasileiro vÃ¡lido." });
    return z.NEVER;
  }
  return phone;
});

export const customerInputSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome ou razÃ£o social.").max(160),
  taxId: documentSchema,
  phone: phoneSchema,
});

export const customerPatchSchema = customerInputSchema.partial().refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para alterar.");

export const customerSearchSchema = z.object({
  q: z.string().trim().max(160).optional().default(""),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
});

export const customerIdSchema = z.string().uuid();

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerPatch = z.infer<typeof customerPatchSchema>;
export type CustomerListQuery = z.infer<typeof customerSearchSchema>;

export type CustomerDTO = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}>;
