import {
  createCustomerAction,
  createDraftAction,
  finalizeCollectionAction,
  saveCollectionSignatureAction,
  searchCustomersAction,
} from "@/app/actions/draft-flow.actions";
import {
  addItemToDraftAction,
  fetchDraftWithItemsAction,
  patchDraftFieldsAction,
  removeItemFromDraftAction,
  updateItemInDraftAction,
} from "../api/actions";
import type { OfflineSyncCommands } from "./offline-commands";

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export const productionOfflineCommands: OfflineSyncCommands = {
  async createCustomer(input) {
    const result = await createCustomerAction({
      displayName: input.displayName,
      taxId: input.taxId,
      phone: input.phone,
      ...(input.street
        ? { address: { street: input.street, city: "São Paulo", stateCode: "SP" } }
        : {}),
    });
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, customerId: result.customerId };
  },
  async searchCustomers(query) {
    const result = await searchCustomersAction(query);
    if (!result.ok) {
      return failure(result.error);
    }
    return {
      ok: true,
      customers: result.customers.map((customer) => ({ id: customer.id, taxId: customer.taxId })),
    };
  },
  async createDraft(input) {
    const result = await createDraftAction(input);
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, draftId: result.draftId, rowVersion: result.rowVersion };
  },
  async patchDraft(input) {
    const result = await patchDraftFieldsAction({
      collectionId: input.collectionId,
      expectedVersion: input.expectedVersion,
      ...(input.collectionLocation === undefined ? {} : { collectionLocation: input.collectionLocation }),
      ...(input.responsibleName === undefined ? {} : { responsibleName: input.responsibleName }),
      ...(input.responsibleTaxId === undefined ? {} : { responsibleTaxId: input.responsibleTaxId }),
      ...(input.collectedAt === undefined ? {} : { collectedAt: input.collectedAt }),
      ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
    });
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, rowVersion: result.draft.rowVersion };
  },
  async addItem(input) {
    const result = await addItemToDraftAction({
      collectionId: input.collectionId,
      expectedVersion: input.expectedVersion,
      description: input.description,
      quantity: input.quantity,
      condition: input.condition,
      notes: input.notes,
      clientItemId: input.clientItemId,
    });
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, item: result.item, rowVersion: result.rowVersion };
  },
  async patchItem(input) {
    const result = await updateItemInDraftAction({
      collectionId: input.collectionId,
      itemId: input.itemId,
      expectedVersion: input.expectedVersion,
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      ...(input.condition === undefined ? {} : { condition: input.condition }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    });
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, rowVersion: result.rowVersion };
  },
  async removeItem(input) {
    const result = await removeItemFromDraftAction(input);
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, rowVersion: result.rowVersion };
  },
  async saveSignature(input) {
    const result = await saveCollectionSignatureAction(input);
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true, rowVersion: result.rowVersion };
  },
  async fetchDraft(collectionId) {
    const result = await fetchDraftWithItemsAction(collectionId);
    if (!result.ok) {
      return failure(result.error);
    }
    return {
      ok: true,
      draft: result.draft,
      items: result.items,
      hasSignature: result.hasSignature,
    };
  },
  async finalize(input) {
    const result = await finalizeCollectionAction(input);
    if (!result.ok) {
      return failure(result.error);
    }
    return { ok: true };
  },
};
