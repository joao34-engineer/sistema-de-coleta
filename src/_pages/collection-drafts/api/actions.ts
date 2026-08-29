"use server";

import { getDraft, patchDraft, addItem, patchItem, removeItem } from "./drafts.server";
import type { DraftDTO, DraftItemDTO } from "../model/draft";
import { toSafeActionError } from "@/shared/lib/action-error";

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
    const res = await getDraft(draftId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO; items: DraftItemDTO[]; hasSignature?: boolean };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "draft_not_found" };
    }

    return {
      ok: true,
      draft: body.data.draft,
      items: body.data.items,
      hasSignature: body.data.hasSignature === true,
    };
  } catch (error: unknown) {
    return toSafeActionError(error);
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
  try {
    const req = new Request(`http://localhost/api/collections/${payload.collectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: payload.expectedVersion,
        description: payload.description,
        quantity: payload.quantity,
        condition: payload.condition ?? null,
        notes: payload.notes ?? null,
        ...(payload.clientItemId === undefined ? {} : { clientItemId: payload.clientItemId }),
      }),
    });

    const res = await addItem(req, payload.collectionId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { item: DraftItemDTO; draft: DraftDTO; rowVersion: number };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "add_item_failed" };
    }

    return {
      ok: true,
      item: body.data.item,
      draft: body.data.draft,
      rowVersion: body.data.rowVersion,
    };
  } catch (error: unknown) {
    return toSafeActionError(error);
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
  try {
    const req = new Request(
      `http://localhost/api/collections/${payload.collectionId}/items/${payload.itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: payload.expectedVersion,
          description: payload.description,
          quantity: payload.quantity,
          condition: payload.condition ?? null,
          notes: payload.notes ?? null,
        }),
      },
    );

    const res = await patchItem(req, payload.collectionId, payload.itemId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { item: DraftItemDTO; draft: DraftDTO; rowVersion: number };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "update_item_failed" };
    }

    return {
      ok: true,
      item: body.data.item,
      draft: body.data.draft,
      rowVersion: body.data.rowVersion,
    };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function removeItemFromDraftAction(payload: {
  collectionId: string;
  itemId: string;
  expectedVersion: number;
}): Promise<RemoveItemActionResult> {
  try {
    const req = new Request(
      `http://localhost/api/collections/${payload.collectionId}/items/${payload.itemId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: payload.expectedVersion }),
      },
    );

    const res = await removeItem(req, payload.collectionId, payload.itemId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO; rowVersion: number };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "remove_item_failed" };
    }

    return {
      ok: true,
      draft: body.data.draft,
      rowVersion: body.data.rowVersion,
    };
  } catch (error: unknown) {
    return toSafeActionError(error);
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
  try {
    const bodyPayload: Record<string, unknown> = { expectedVersion: payload.expectedVersion };
    if (payload.customerId !== undefined) bodyPayload["customerId"] = payload.customerId;
    if (payload.collectionLocation !== undefined) bodyPayload["collectionLocation"] = payload.collectionLocation;
    if (payload.responsibleName !== undefined) bodyPayload["responsibleName"] = payload.responsibleName;
    if (payload.responsibleTaxId !== undefined) bodyPayload["responsibleTaxId"] = payload.responsibleTaxId;
    if (payload.collectedAt !== undefined) bodyPayload["collectedAt"] = payload.collectedAt;

    const req = new Request(`http://localhost/api/collections/${payload.collectionId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
    const res = await patchDraft(req, payload.collectionId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO };
      code?: string;
    };
    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "patch_draft_failed" };
    }
    return { ok: true, draft: body.data.draft };
  } catch (error: unknown) {
    return toSafeActionError(error);
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
