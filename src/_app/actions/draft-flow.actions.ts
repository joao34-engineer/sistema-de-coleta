"use server";

import { createDraft } from "@/_pages/collection-drafts/api/drafts.server";
import { saveCollectionSignature, finalizeCollection } from "@/_pages/collection-lifecycle/index.server";
import { listCustomers, createCustomer } from "@/_pages/customers/index.server";
import { toSafeActionError } from "@/shared/lib/action-error";

/** Forma mínima de cliente consumida pela tela de nova coleta. */
export type CustomerView = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
  address?: Readonly<{ street: string }> | null;
}>;

export type CreateDraftActionResult =
  | { ok: true; draftId: string; rowVersion: number }
  | { ok: false; error: string; issues?: unknown };

export type CreateCustomerActionResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string; issues?: unknown };

export type SaveSignatureActionResult =
  | { ok: true; rowVersion: number; signatureId: string }
  | { ok: false; error: string };

export type FinalizeOnlyActionResult =
  | { ok: true; collectionId: string; documentUrl?: string }
  | { ok: false; error: string };

export type SearchCustomersActionResult =
  | { ok: true; customers: readonly CustomerView[] }
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
    const body = (await res.json()) as { ok: boolean; data?: { customers: CustomerView[] }; code?: string };

    if (!res.ok || !body.ok || !body.data) {
      return { ok: false, error: body.code ?? "search_failed" };
    }

    return { ok: true, customers: body.data.customers };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function createCustomerAction(payload: {
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
}): Promise<CreateCustomerActionResult> {
  try {
    const customerReq = new Request("http://localhost/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const customerRes = await createCustomer(customerReq);
    const customerBody = (await customerRes.json()) as {
      ok: boolean;
      data?: { customer: CustomerView };
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
    return { ok: true, customerId: customerBody.data.customer.id };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function createDraftAction(payload: {
  draftId: string;
  customerId: string;
}): Promise<CreateDraftActionResult> {
  try {
    const draftReq = new Request("http://localhost/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: payload.draftId, customerId: payload.customerId }),
    });
    const draftRes = await createDraft(draftReq);
    const draftBody = (await draftRes.json()) as {
      ok: boolean;
      data?: { draft: { id: string; rowVersion: number } };
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
    return { ok: true, draftId: draftBody.data.draft.id, rowVersion: draftBody.data.draft.rowVersion };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function createDraftWithCustomerAction(payload: {
  draftId: string;
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
      const created = await createCustomerAction(payload.newCustomer);
      if (!created.ok) {
        return created;
      }
      customerId = created.customerId;
    }

    if (!customerId) {
      return { ok: false, error: "customer_required" };
    }

    return await createDraftAction({ draftId: payload.draftId, customerId });
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function saveCollectionSignatureAction(payload: {
  collectionId: string;
  expectedVersion: number;
  signerName: string;
  signerTaxId: string;
  acceptanceText: string;
  signatureBase64Png: string;
}): Promise<SaveSignatureActionResult> {
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
    return { ok: true, rowVersion: signatureResult.rowVersion, signatureId: signatureResult.signatureId };
  } catch (error: unknown) {
    return toSafeActionError(error);
  }
}

export async function finalizeCollectionAction(payload: {
  collectionId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<FinalizeOnlyActionResult> {
  try {
    const finalizeResult = await finalizeCollection(
      payload.collectionId,
      payload.expectedVersion,
      payload.idempotencyKey,
    );
    const documentUrl = finalizeResult.document?.id ? `/api/documents/${finalizeResult.document.id}` : undefined;
    return {
      ok: true,
      collectionId: payload.collectionId,
      ...(documentUrl ? { documentUrl } : {}),
    };
  } catch (error: unknown) {
    return toSafeActionError(error);
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
  const saved = await saveCollectionSignatureAction({
    collectionId: payload.collectionId,
    expectedVersion: payload.expectedVersion,
    signerName: payload.signerName,
    signerTaxId: payload.signerTaxId,
    acceptanceText: payload.acceptanceText,
    signatureBase64Png: payload.signatureBase64Png,
  });
  if (!saved.ok) {
    return saved;
  }
  return finalizeCollectionAction({
    collectionId: payload.collectionId,
    expectedVersion: saved.rowVersion,
    idempotencyKey: payload.idempotencyKey,
  });
}
