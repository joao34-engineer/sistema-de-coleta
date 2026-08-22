"use server";

import { createDraft } from "@/_pages/collection-drafts/api/drafts.server";
import { saveCollectionSignature, finalizeCollection } from "@/_pages/collection-lifecycle/index.server";
import { listCustomers, createCustomer } from "@/_pages/customers/index.server";

/** Forma mínima de cliente consumida pela tela de nova coleta. */
export type CustomerView = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
  address?: Readonly<{ street: string }> | null;
}>;

export type CreateDraftActionResult =
  | { ok: true; draftId: string }
  | { ok: false; error: string; issues?: unknown };

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
      data?: { draft: { rowVersion: number } };
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

    return { ok: true, draftId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "draft_unexpected_error";
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
