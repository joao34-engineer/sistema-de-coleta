export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(value: string): boolean {
  const digits = normalizeDigits(value);
  if (digits.length !== 14 || /^([0-9])\1{13}$/.test(digits)) return false;

  const calculateDigit = (slice: string): number => {
    const weights = slice.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = slice.split("").reduce((total, char, index) => total + Number(char) * (weights[index] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(digits.slice(0, 12));
  const second = calculateDigit(digits.slice(0, 12) + String(first));
  return first === Number(digits[12]) && second === Number(digits[13]);
}
