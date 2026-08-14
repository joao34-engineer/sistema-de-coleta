import { z } from "zod";
import { isValidCnpj, normalizeDigits } from "@/shared/lib/cnpj";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const companySettingsSchema = z.object({
  legalName: optionalText(160),
  taxId: z.string().trim().transform(normalizeDigits).refine((value) => value === "" || isValidCnpj(value), "Informe um CNPJ válido.").transform((value) => value || null),
  phone: optionalText(30),
  street: optionalText(160),
  streetNumber: optionalText(20),
  complement: optionalText(120),
  district: optionalText(100),
  city: optionalText(100),
  stateCode: z.string().trim().toUpperCase().refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Use a UF com duas letras.").transform((value) => value || null),
  postalCode: z.string().trim().transform(normalizeDigits).refine((value) => value === "" || /^\d{8}$/.test(value), "Informe um CEP com 8 dígitos.").transform((value) => value || null),
  receiptLegalText: optionalText(2000),
  signerName: optionalText(160),
  signerTitle: optionalText(120),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
