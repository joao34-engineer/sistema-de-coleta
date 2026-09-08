import { z } from "zod";
import { isValidCnpj, normalizeDigits } from "./cnpj";

export const INVALID_SIGNER_TAX_ID_COPY = "CPF ou CNPJ inválido, revise e tente novamente.";

export function isValidCpf(value: string): boolean {
  const digits = normalizeDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (base: string): number => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * (base.length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(digits.slice(0, 9)) === Number(digits[9]) && checkDigit(digits.slice(0, 10)) === Number(digits[10]);
}

export function isValidCpfOrCnpj(value: string): boolean {
  const digits = normalizeDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function invalidCpfOrCnpjMessage(value: string): string {
  const digits = normalizeDigits(value);
  if (digits.length === 11) return "CPF inválido, revise e tente novamente.";
  if (digits.length === 14) return "CNPJ inválido, revise e tente novamente.";
  return "Informe um CPF ou CNPJ válido.";
}

export const cpfOrCnpjSchema = z
  .string()
  .trim()
  .transform(normalizeDigits)
  .refine(isValidCpfOrCnpj, "Informe um CPF ou CNPJ válido.");

export const optionalCpfOrCnpjSchema = z.union([z.null(), cpfOrCnpjSchema]).optional();

export function zodIssueTouchesKey(
  error: Readonly<{ issues: readonly Readonly<{ path: readonly PropertyKey[] }>[] }>,
  key: string,
): boolean {
  return error.issues.some((issue) => issue.path.includes(key));
}
