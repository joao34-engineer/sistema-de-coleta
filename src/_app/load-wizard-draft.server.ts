import "server-only";

import { getDraft, toOfflineExistingCustomer, type WizardDraftProps } from "@/_pages/collection-drafts/index.server";
import { loadCustomerDto } from "@/_pages/customers/index.server";

export type LoadWizardDraftResult = ({ ok: true } & WizardDraftProps) | { ok: false };

export async function loadWizardDraftForPage(id: string): Promise<LoadWizardDraftResult> {
  try {
    const data = await getDraft(id);
    const customerId = data.draft.customerId;
    if (customerId === null) {
      return { ok: false };
    }
    const loaded = await loadCustomerDto(customerId);
    if (!loaded.ok) {
      return { ok: false };
    }
    const customer = toOfflineExistingCustomer({
      customerId,
      displayName: loaded.customer.displayName,
      taxId: loaded.customer.taxId,
      phone: loaded.customer.phone,
      street: loaded.customer.address?.street ?? null,
      city: loaded.customer.address?.city ?? null,
      stateCode: loaded.customer.address?.stateCode ?? null,
    });
    if (customer === null) {
      return { ok: false };
    }
    return {
      ok: true,
      draft: data.draft,
      items: data.items,
      hasSignature: data.hasSignature,
      customer,
    };
  } catch {
    return { ok: false };
  }
}

export function wizardDraftFromLoad(result: LoadWizardDraftResult): WizardDraftProps | undefined {
  if (!result.ok) {
    return undefined;
  }
  return {
    draft: result.draft,
    items: result.items,
    hasSignature: result.hasSignature,
    customer: result.customer,
  };
}
