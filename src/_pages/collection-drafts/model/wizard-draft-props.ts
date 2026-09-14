import { isValidCpfOrCnpj } from "@/shared/lib/cpf";
import type { CaptureActor, CaptureStep } from "./capture-actor";
import type { DraftDTO, DraftItemDTO } from "./draft";
import { asStoredTaxId } from "./offline-capture";
import type { OfflineCustomer, OfflineDraftRecord, OfflineItemRecord } from "./offline-records";

export type CustomerIdentityInput = Readonly<{
  customerId: string;
  displayName: string;
  taxId: string;
  phone: string;
  street?: string | null;
  city?: string | null;
  stateCode?: string | null;
}>;

export type WizardDraftProps = Readonly<{
  draft: DraftDTO;
  items: readonly DraftItemDTO[];
  hasSignature: boolean;
  customer: OfflineCustomer;
}>;

const PREVIEW_FINALIZE_KEY = "00000000-0000-4000-8000-000000000000";

export function toOfflineExistingCustomer(input: CustomerIdentityInput): OfflineCustomer | null {
  const taxId = asStoredTaxId(input.taxId);
  if (taxId === null || !isValidCpfOrCnpj(taxId) || input.phone.trim().length < 8) {
    return null;
  }
  const city = input.city?.trim() ?? "";
  const stateCode = input.stateCode?.trim().toUpperCase() ?? "";
  return {
    mode: "existing",
    customerId: input.customerId,
    displayName: input.displayName,
    taxId,
    phone: input.phone,
    street: input.street ?? null,
    ...(city === "" ? {} : { city }),
    ...(stateCode === "" || !/^[A-Z]{2}$/.test(stateCode) ? {} : { stateCode }),
  };
}

export function toOfflineDraftPreview(input: {
  actor: CaptureActor;
  draft: DraftDTO;
  items: readonly DraftItemDTO[];
  hasSignature: boolean;
  step: CaptureStep;
  customer: OfflineCustomer;
}): { draft: OfflineDraftRecord; items: readonly OfflineItemRecord[] } {
  const taxId = asStoredTaxId(input.customer.taxId) ?? input.customer.taxId;
  const street = input.customer.street === null || input.customer.street === undefined ? null : input.customer.street.slice(0, 160);
  const record: OfflineDraftRecord = {
    id: input.draft.id,
    userId: input.actor.userId,
    organizationId: input.actor.organizationId,
    currentStep: input.step,
    customer: {
      ...input.customer,
      taxId,
      street,
    },
    collectionLocation: input.draft.collectionLocation,
    responsibleName: input.draft.responsibleName,
    responsibleTaxId: asStoredTaxId(input.draft.responsibleTaxId),
    collectedAt: input.draft.collectedAt,
    serverRowVersion: input.draft.rowVersion,
    serverCustomerId: input.draft.customerId,
    hasServerSignature: input.hasSignature,
    finalizeIdempotencyKey: PREVIEW_FINALIZE_KEY,
    syncStatus: "synced",
    lastError: null,
    createdAt: input.draft.createdAt,
    updatedAt: input.draft.updatedAt,
  };
  const items = input.items.map((item) => ({
    id: item.id,
    collectionId: input.draft.id,
    userId: input.actor.userId,
    description: item.description,
    quantity: item.quantity,
    condition: item.condition,
    notes: item.notes,
    removed: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
  return { draft: record, items };
}
