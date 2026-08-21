"use server";

import { createDraft, getDraft, patchDraft, addItem, patchItem, removeItem } from "./drafts.server";
import { createCustomer, listCustomers } from "@/_pages/customers/api/customers.server";
import { saveCollectionSignature, finalizeCollection } from "@/_pages/collection-lifecycle/api/commands";
import type { CustomerDTO } from "@/_pages/customers/model/customer";
import type { DraftDTO, DraftItemDTO } from "../model/draft";

export type CreateDraftActionResult =
  | { ok: true; draftId: string }
  | { ok: false; error: string; issues?: unknown };

export type SearchCustomersActionResult =
  | { ok: true; customers: readonly CustomerDTO[] }
  | { ok: false; error: string };

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

export type FinalizeCollectionActionResult =
  | { ok: true; collectionId: string; documentUrl?: string }
  | { ok: false; error: string };

export async function searchCustomersAction(query: string): Promise<SearchCustomersActionResult> {
  try {
    const url = new URL("http://localhost/api/customers");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");

    const req = new Request(url.toString());
    const res = await listCustomers(req);
    const body = (await res.json()) as { ok: boolean; data?: { customers: CustomerDTO[] }; code?: string };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "search_failed" };
    }

    return { ok: true, customers: body.data.customers };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "search_unexpected_error";
    return { ok: false, error: message };
  }
}

export async function createDraftWithCustomerAction(payload: {
  existingCustomerId?: string | null;
  newCustomer?: {
    displayName: string;
    taxId: string;
    phone: string;
    address?: {
      street: string;
      streetNumber?: string | null;
      complement?: string | null;
      district?: string | null;
      city: string;
      stateCode: string;
      postalCode?: string | null;
    };
  };
  collectionLocation?: string | null;
}): Promise<CreateDraftActionResult> {
  try {
    let customerId: string | null = payload.existingCustomerId ?? null;

    if (!customerId && payload.newCustomer) {
      const customerReq = new Request("http://localhost/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.newCustomer),
      });

      const customerRes = await createCustomer(customerReq);
      const customerBody = (await customerRes.json()) as {
        ok: boolean;
        data?: { customer: CustomerDTO };
        code?: string;
        issues?: unknown;
      };

      if (!customerRes.ok || !customerBody.ok || !customerBody.data) {
        return {
          ok: false,
          error: customerBody.code ?? "customer_creation_failed",
          issues: customerBody.issues,
        };
      }

      customerId = customerBody.data.customer.id;
    }

    if (!customerId) {
      return { ok: false, error: "customer_required" };
    }

    const draftId = crypto.randomUUID();
    const draftReq = new Request("http://localhost/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId, customerId }),
    });

    const draftRes = await createDraft(draftReq);
    const draftBody = (await draftRes.json()) as {
      ok: boolean;
      data?: { draft: DraftDTO };
      code?: string;
      issues?: unknown;
    };

    if (!draftRes.ok || !draftBody.ok || !draftBody.data) {
      return {
        ok: false,
        error: draftBody.code ?? "draft_creation_failed",
        issues: draftBody.issues,
      };
    }

    if (payload.collectionLocation && payload.collectionLocation.trim().length > 0) {
      const patchReq = new Request(`http://localhost/api/collections/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: draftBody.data.draft.rowVersion,
          collectionLocation: payload.collectionLocation.trim(),
        }),
      });
      await patchDraft(patchReq, draftId);
    }

    return { ok: true, draftId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "draft_unexpected_error";
    return { ok: false, error: message };
  }
}

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

export async function finalizeCollectionWithSignatureAction(payload: {
  collectionId: string;
  expectedVersion: number;
  signerName: string;
  signerTaxId: string;
  acceptanceText: string;
  signatureBase64Png: string;
  idempotencyKey: string;
}): Promise<FinalizeCollectionActionResult> {
  try {
    const cleanBase64 = payload.signatureBase64Png.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const signatureFile = new File([buffer], "signature.png", { type: "image/png" });

    const signatureResult = await saveCollectionSignature(
      payload.collectionId,
      {
        expectedVersion: payload.expectedVersion,
        signerName: payload.signerName,
        signerTaxId: payload.signerTaxId,
        acceptanceText: payload.acceptanceText,
      },
      signatureFile,
    );

    const updatedVersion = signatureResult.rowVersion;

    const finalizeResult = await finalizeCollection(
      payload.collectionId,
      updatedVersion,
      payload.idempotencyKey,
    );

    const documentUrl = finalizeResult.document?.id ? `/api/documents/${finalizeResult.document.id}` : undefined;

    return {
      ok: true,
      collectionId: payload.collectionId,
      ...(documentUrl ? { documentUrl } : {}),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "finalize_collection_unexpected_error";
    return { ok: false, error: message };
  }
}

