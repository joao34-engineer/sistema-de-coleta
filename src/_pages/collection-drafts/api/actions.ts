"use server";

import { getDraft, patchDraft, addItem, patchItem, removeItem } from "./drafts.server";
import type { DraftDTO, DraftItemDTO } from "../model/draft";

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

export async function fetchDraftWithItemsAction(draftId: string): Promise<{
  ok: boolean;
  draft?: DraftDTO;
  items?: readonly DraftItemDTO[];
  error?: string;
}> {
  try {
    const res = await getDraft(draftId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO; items: DraftItemDTO[] };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "draft_not_found" };
    }

    return { ok: true, draft: body.data.draft, items: body.data.items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "fetch_draft_unexpected_error";
    return { ok: false, error: message };
  }
}

export async function addItemToDraftAction(payload: {
  collectionId: string;
  expectedVersion: number;
  description: string;
  quantity: number;
  condition?: string | null;
  notes?: string | null;
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
    const message = error instanceof Error ? error.message : "add_item_unexpected_error";
    return { ok: false, error: message };
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
    const message = error instanceof Error ? error.message : "update_item_unexpected_error";
    return { ok: false, error: message };
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
    const message = error instanceof Error ? error.message : "remove_item_unexpected_error";
    return { ok: false, error: message };
  }
}

export async function updateDraftResponsibleAction(payload: {
  collectionId: string;
  expectedVersion: number;
  responsibleName: string;
  responsibleTaxId?: string | null;
}): Promise<UpdateResponsibleActionResult> {
  try {
    const req = new Request(`http://localhost/api/collections/${payload.collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: payload.expectedVersion,
        responsibleName: payload.responsibleName,
        responsibleTaxId: payload.responsibleTaxId ?? null,
      }),
    });

    const res = await patchDraft(req, payload.collectionId);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO };
      code?: string;
    };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "update_responsible_failed" };
    }

    return { ok: true, draft: body.data.draft };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "update_responsible_unexpected_error";
    return { ok: false, error: message };
  }
}
