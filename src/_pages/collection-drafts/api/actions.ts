"use server";

import { toActionFailureCode } from "@/shared/lib/action-failure-code";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";
import {
  collectionIdSchema,
  draftPatchSchema,
  itemCreateCommandSchema,
  itemPatchCommandSchema,
  type DraftDTO,
  type DraftItemDTO,
} from "../model/draft";
import { addItem, patchDraft, patchItem, removeItem } from "./commands";
import { collectionExists, getDraft } from "./queries";

export async function collectionExistsAction(collectionId: string): Promise<boolean> {
  try {
    return await collectionExists(collectionId);
  } catch {
    return false;
  }
}

export type CreateDraftActionResult =
  | { ok: true; draftId: string }
  | { ok: false; error: string; issues?: unknown };

export type AddItemActionResult =
  | { ok: true; item: DraftItemDTO; draft: DraftDTO; rowVersion: number }
  | { ok: false; error: string };

export type UpdateItemActionResult =
  | { ok: true; item: DraftItemDTO; draft: DraftDTO; rowVersion: number }
  | { ok: false; error: string };

export type RemoveItemActionResult =
  | { ok: true; draft: DraftDTO; rowVersion: number }
  | { ok: false; error: string };

export type UpdateResponsibleActionResult =
  | { ok: true; draft: DraftDTO }
  | { ok: false; error: string };

export async function fetchDraftWithItemsAction(draftId: string): Promise<
  | { ok: true; draft: DraftDTO; items: readonly DraftItemDTO[]; hasSignature: boolean }
  | { ok: false; error: string }
> {
  try {
    const data = await getDraft(draftId);
    return { ok: true, draft: data.draft, items: data.items, hasSignature: data.hasSignature };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export async function addItemToDraftAction(payload: {
  collectionId: string;
  expectedVersion: number;
  description: string;
  quantity: number;
  condition?: string | null;
  notes?: string | null;
  clientItemId?: string;
}): Promise<AddItemActionResult> {
  const parsed = itemCreateCommandSchema.safeParse({
    expectedVersion: payload.expectedVersion,
    description: payload.description,
    quantity: payload.quantity,
    condition: payload.condition ?? null,
    notes: payload.notes ?? null,
    ...(payload.clientItemId === undefined ? {} : { clientItemId: payload.clientItemId }),
  });
  if (!parsed.success) {
    return { ok: false, error: "validation_error" };
  }
  const collectionId = collectionIdSchema.safeParse(payload.collectionId);
  if (!collectionId.success) {
    return { ok: false, error: "validation_error" };
  }
  try {
    const data = await addItem(collectionId.data, parsed.data);
    return { ok: true, item: data.item, draft: data.draft, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export async function updateItemInDraftAction(payload: {
  collectionId: string;
  itemId: string;
  expectedVersion: number;
  description?: string;
  quantity?: number;
  condition?: string | null;
  notes?: string | null;
}): Promise<UpdateItemActionResult> {
  const parsed = itemPatchCommandSchema.safeParse({
    expectedVersion: payload.expectedVersion,
    description: payload.description,
    quantity: payload.quantity,
    condition: payload.condition ?? null,
    notes: payload.notes ?? null,
  });
  if (!parsed.success) {
    return { ok: false, error: "validation_error" };
  }
  try {
    const data = await patchItem(payload.collectionId, payload.itemId, parsed.data);
    return { ok: true, item: data.item, draft: data.draft, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export async function removeItemFromDraftAction(payload: {
  collectionId: string;
  itemId: string;
  expectedVersion: number;
}): Promise<RemoveItemActionResult> {
  try {
    const data = await removeItem(payload.collectionId, payload.itemId, payload.expectedVersion);
    return { ok: true, draft: data.draft, rowVersion: data.rowVersion };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export type PatchDraftFieldsActionResult =
  | { ok: true; draft: DraftDTO }
  | { ok: false; error: string };

export async function patchDraftFieldsAction(payload: {
  collectionId: string;
  expectedVersion: number;
  customerId?: string | null;
  collectionLocation?: string | null;
  responsibleName?: string | null;
  responsibleTaxId?: string | null;
  collectedAt?: string | null;
}): Promise<PatchDraftFieldsActionResult> {
  const bodyPayload: Record<string, unknown> = { expectedVersion: payload.expectedVersion };
  if (payload.customerId !== undefined) bodyPayload["customerId"] = payload.customerId;
  if (payload.collectionLocation !== undefined) bodyPayload["collectionLocation"] = payload.collectionLocation;
  if (payload.responsibleName !== undefined) bodyPayload["responsibleName"] = payload.responsibleName;
  if (payload.responsibleTaxId !== undefined) bodyPayload["responsibleTaxId"] = payload.responsibleTaxId;
  if (payload.collectedAt !== undefined) bodyPayload["collectedAt"] = payload.collectedAt;
  const parsed = draftPatchSchema.safeParse(bodyPayload);
  if (!parsed.success) {
    if (zodIssueTouchesKey(parsed.error, "responsibleTaxId")) {
      return { ok: false, error: "invalid_signer_tax_id" };
    }
    return { ok: false, error: "validation_error" };
  }
  const collectionId = collectionIdSchema.safeParse(payload.collectionId);
  if (!collectionId.success) {
    return { ok: false, error: "validation_error" };
  }
  try {
    const draft = await patchDraft(collectionId.data, parsed.data);
    return { ok: true, draft };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export async function updateDraftResponsibleAction(payload: {
  collectionId: string;
  expectedVersion: number;
  responsibleName: string;
  responsibleTaxId?: string | null;
}): Promise<UpdateResponsibleActionResult> {
  const result = await patchDraftFieldsAction({
    collectionId: payload.collectionId,
    expectedVersion: payload.expectedVersion,
    responsibleName: payload.responsibleName,
    ...(payload.responsibleTaxId === undefined ? {} : { responsibleTaxId: payload.responsibleTaxId }),
  });
  return result;
}
