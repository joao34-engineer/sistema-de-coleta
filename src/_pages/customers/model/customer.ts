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

const optionalPostalCodeSchema = z.string().trim().transform(normalizeDigits).pipe(z.string().regex(/^\d{8}$/, "Informe um CEP com 8 dígitos.")).nullable().optional();

export const customerAddressInputSchema = z.object({
  label: z.string().trim().max(80).nullable().optional(),
  street: z.string().trim().min(1, "Informe a rua.").max(160),
  streetNumber: z.string().trim().max(20).nullable().optional(),
  complement: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().min(1, "Informe a cidade.").max(100),
  stateCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Informe a UF.").transform((value) => value as string),
  postalCode: optionalPostalCodeSchema,
  isPrimary: z.boolean().optional().default(true),
});

export const customerAddressPatchSchema = customerAddressInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para alterar.",
);

export const customerInputSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome ou razÃ£o social.").max(160),
  taxId: documentSchema,
  phone: phoneSchema,
  address: customerAddressInputSchema.optional(),
});

export const customerPatchSchema = customerInputSchema.omit({ address: true }).partial().refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para alterar.");

export const customerSearchSchema = z.object({
  q: z.string().trim().max(160).optional().default(""),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
});

export const customerIdSchema = z.string().uuid();

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerPatch = z.infer<typeof customerPatchSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressInputSchema>;
export type CustomerAddressPatch = z.infer<typeof customerAddressPatchSchema>;
export type CustomerListQuery = z.infer<typeof customerSearchSchema>;

export type CustomerAddressDTO = Readonly<{
  id: string;
  customerId: string;
  label: string | null;
  street: string;
  streetNumber: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  stateCode: string;
  postalCode: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type CustomerDTO = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
  address: CustomerAddressDTO | null;
  createdAt: string;
  updatedAt: string;
}>;
