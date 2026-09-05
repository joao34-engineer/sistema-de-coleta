import { hasRequiredCollectionLocation } from "./has-required-collection-location";
import { normalizeTaxId } from "./offline-capture";

export function canFinalizeCollection(input: {
  collectionLocation: string | null | undefined;
  signatureDataUrl: string | null;
  signerName: string;
  signerTaxId: string;
}): boolean {
  if (!hasRequiredCollectionLocation(input.collectionLocation)) {
    return false;
  }
  if (input.signatureDataUrl === null || input.signatureDataUrl.trim() === "") {
    return false;
  }
  if (input.signerName.trim() === "") {
    return false;
  }
  return /^\d{11}$|^\d{14}$/.test(normalizeTaxId(input.signerTaxId));
}
