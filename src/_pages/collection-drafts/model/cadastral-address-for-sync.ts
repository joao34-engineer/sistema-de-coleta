export type CadastralAddress = Readonly<{
  street: string;
  city: string;
  stateCode: string;
}>;

/** Address is sent only when street, city and UF are all present. Street-only leftovers stay local. */
export function cadastralAddressForSync(input: {
  street?: string | null;
  city?: string | null;
  stateCode?: string | null;
}): CadastralAddress | null {
  const street = input.street?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const stateCode = input.stateCode?.trim().toUpperCase() ?? "";
  if (street !== "" && city !== "" && /^[A-Z]{2}$/.test(stateCode)) {
    return { street, city, stateCode };
  }
  return null;
}

export function isIncompleteCadastral(input: {
  street?: string | null;
  city?: string | null;
  stateCode?: string | null;
}): boolean {
  const street = input.street?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const stateCode = input.stateCode?.trim().toUpperCase() ?? "";
  const hasAny = street !== "" || city !== "" || stateCode !== "";
  return hasAny && cadastralAddressForSync(input) === null;
}
