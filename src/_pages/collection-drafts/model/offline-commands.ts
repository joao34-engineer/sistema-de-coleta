import type { DraftDTO, DraftItemDTO } from "./draft";

export type CommandFailure = Readonly<{ ok: false; error: string }>;

export type CreateCustomerCommandResult =
  | { ok: true; customerId: string }
  | CommandFailure;

export type CreateDraftCommandResult =
  | { ok: true; draftId: string; rowVersion: number }
  | CommandFailure;

export type PatchDraftCommandResult =
  | { ok: true; rowVersion: number }
  | CommandFailure;

export type AddItemCommandResult =
  | { ok: true; item: DraftItemDTO; rowVersion: number }
  | CommandFailure;

export type MutationCommandResult =
  | { ok: true; rowVersion: number }
  | CommandFailure;

export type FetchDraftCommandResult =
  | { ok: true; draft: DraftDTO; items: readonly DraftItemDTO[]; hasSignature: boolean }
  | CommandFailure;

export type SearchCustomerCommandResult =
  | { ok: true; customers: readonly Readonly<{ id: string; taxId: string }>[] }
  | CommandFailure;

export type FinalizeCommandResult = { ok: true } | CommandFailure;

export type FetchCustomerCommandResult =
  | {
      ok: true;
      customer: Readonly<{
        id: string;
        displayName: string;
        taxId: string;
        phone: string;
        street: string | null;
        city: string | null;
        stateCode: string | null;
      }>;
    }
  | CommandFailure;

export type DiscardDraftCommandResult = { ok: true } | CommandFailure;

export type OfflineSyncCommands = {
  createCustomer(input: {
    displayName: string;
    taxId: string;
    phone: string;
    street: string | null;
    city?: string | null;
    stateCode?: string | null;
  }): Promise<CreateCustomerCommandResult>;
  searchCustomers(query: string): Promise<SearchCustomerCommandResult>;
  createDraft(input: { draftId: string; customerId: string }): Promise<CreateDraftCommandResult>;
  patchDraft(input: {
    collectionId: string;
    expectedVersion: number;
    collectionLocation?: string | null;
    responsibleName?: string | null;
    responsibleTaxId?: string | null;
    collectedAt?: string | null;
    customerId?: string | null;
  }): Promise<PatchDraftCommandResult>;
  addItem(input: {
    collectionId: string;
    expectedVersion: number;
    clientItemId: string;
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }): Promise<AddItemCommandResult>;
  patchItem(input: {
    collectionId: string;
    itemId: string;
    expectedVersion: number;
    description?: string;
    quantity?: number;
    condition?: string | null;
    notes?: string | null;
  }): Promise<MutationCommandResult>;
  removeItem(input: {
    collectionId: string;
    itemId: string;
    expectedVersion: number;
  }): Promise<MutationCommandResult>;
  saveSignature(input: {
    collectionId: string;
    expectedVersion: number;
    signerName: string;
    signerTaxId: string;
    acceptanceText: string;
    signatureBase64Png: string;
  }): Promise<MutationCommandResult>;
  fetchDraft(collectionId: string): Promise<FetchDraftCommandResult>;
  fetchCustomer(customerId: string): Promise<FetchCustomerCommandResult>;
  discardDraft(input: {
    collectionId: string;
    expectedVersion: number;
  }): Promise<DiscardDraftCommandResult>;
  finalize(input: {
    collectionId: string;
    expectedVersion: number;
    idempotencyKey: string;
  }): Promise<FinalizeCommandResult>;
};
