import { normalizeDigits } from "./cnpj";

export function normalizeBrazilianPhone(value: string): string | null {
  const digits = normalizeDigits(value);
  const nationalNumber = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if (!/^\d{10,11}$/.test(nationalNumber)) return null;
  if (!/^[1-9]\d(?:9\d{8}|\d{8})$/.test(nationalNumber)) return null;
  return nationalNumber;
}
