import { randomUUID } from "node:crypto";

export type SyntheticCustomerInput = Readonly<{
  displayName: string;
  taxId: string;
  phone: string;
}>;

export type SyntheticAddressInput = Readonly<{
  label: string;
  street: string;
  streetNumber: string;
  addressComplement: string;
  district: string;
  city: string;
  stateCode: string;
  postalCode: string;
  isPrimary: boolean;
}>;

export type SyntheticItemInput = Readonly<{
  description: string;
  quantity: number;
  condition?: string;
  notes?: string;
}>;

const onePixelPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99,
  0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function decimalDigits(seed: string, count: number): string {
  const hex = seed.replaceAll("-", "");
  let digits = "";
  for (const character of hex) {
    const code = Number.parseInt(character, 16);
    if (Number.isFinite(code)) digits += String(code % 10);
    if (digits.length >= count) break;
  }
  return digits.padEnd(count, "7").slice(0, count);
}

function cpfCheckDigit(base: string): number {
  const factor = base.length + 1;
  const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (factor - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function syntheticCpf(seed = randomUUID()): string {
  let base = decimalDigits(seed, 9);
  if (/^(\d)\1{8}$/.test(base)) base = `1${base.slice(1)}`;
  const first = cpfCheckDigit(base);
  const second = cpfCheckDigit(`${base}${first}`);
  return `${base}${first}${second}`;
}

export function syntheticCustomer(seed = randomUUID()): SyntheticCustomerInput {
  const suffix = seed.replaceAll("-", "").slice(0, 10);
  return {
    displayName: `QA Cliente Sintetico ${suffix}`,
    taxId: syntheticCpf(seed),
    phone: "11998765432",
  };
}

export function syntheticAddress(seed = randomUUID()): SyntheticAddressInput {
  const suffix = seed.replaceAll("-", "").slice(0, 8);
  return {
    label: `QA ${suffix}`,
    street: "Rua Sintetica de Testes",
    streetNumber: "100",
    addressComplement: "Sala QA",
    district: "Centro",
    city: "Sao Paulo",
    stateCode: "SP",
    postalCode: "01311000",
    isPrimary: true,
  };
}

export function syntheticItem(seed = randomUUID()): SyntheticItemInput {
  return {
    description: `Item sintetico ${seed.replaceAll("-", "").slice(0, 10)}`,
    quantity: 1,
    condition: "Integro",
    notes: "Fixture de integracao da Fase 1A.",
  };
}

export function syntheticCollectionId(): string {
  return randomUUID();
}

export function syntheticIdempotencyKey(): string {
  return randomUUID();
}

export function syntheticPngFile(name = "qa-evidence.png"): File {
  return new File([onePixelPng], name, { type: "image/png" });
}

export function syntheticFormData(
  fields: Readonly<Record<string, string | File | null>>,
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) formData.append(key, value);
  }
  return formData;
}

