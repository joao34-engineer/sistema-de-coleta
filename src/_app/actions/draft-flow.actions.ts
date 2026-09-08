"use server";

import { createDraft, discardCollectionDraft } from "@/_pages/collection-drafts/api/drafts.server";
import { patchDraftFieldsAction } from "@/_pages/collection-drafts/api/actions";
import { saveCollectionSignature, finalizeCollection, signatureInputSchema } from "@/_pages/collection-lifecycle/index.server";
import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/api/schedule-document-render-kick";
import { listCustomers, createCustomer, loadCustomerDto } from "@/_pages/customers/index.server";
import { toActionFailureCode, toFinalizeActionFailureCode } from "@/shared/lib/action-failure-code";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";
import { getRequestId } from "@/shared/lib/server-logger";

/** Forma mínima de cliente consumida pela tela de nova coleta. */
export type CustomerView = Readonly<{
  id: string;
  displayName: string;
  taxId: string;
  phone: string;
  address?: Readonly<{ street: string; city?: string; stateCode?: string }> | null;
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

export type GetCustomerActionResult =
  | { ok: true; customer: CustomerView }
  | { ok: false; error: string };

export type DiscardDraftActionResult = { ok: true } | { ok: false; error: string };

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
    return { ok: false, error: toActionFailureCode(error) };
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
    return { ok: false, error: toActionFailureCode(error) };
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
    return { ok: false, error: toActionFailureCode(error) };
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

    const created = await createDraftAction({ draftId: payload.draftId, customerId });
    if (!created.ok) {
      return created;
    }

    const location = payload.collectionLocation?.trim();
    if (location) {
      const patched = await patchDraftFieldsAction({
        collectionId: created.draftId,
        expectedVersion: created.rowVersion,
        collectionLocation: location,
      });
      if (!patched.ok) {
        return { ok: false, error: patched.error };
      }
    }

    return created;
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
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
  const parsed = signatureInputSchema.safeParse({
    signerName: payload.signerName,
    signerTaxId: payload.signerTaxId,
    acceptanceText: payload.acceptanceText,
    expectedVersion: payload.expectedVersion,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: zodIssueTouchesKey(parsed.error, "signerTaxId") ? "invalid_signer_tax_id" : "validation_error",
    };
  }
  try {
    const cleanBase64 = payload.signatureBase64Png.replace(/^data:image\/png;base64,/, "");
    const bytes = Uint8Array.from(Buffer.from(cleanBase64, "base64"));
    const signatureFile = new File([bytes], "signature.png", { type: "image/png" });
    const signatureResult = await saveCollectionSignature(
      payload.collectionId,
      parsed.data,
      signatureFile,
      getRequestId(),
    );
    return { ok: true, rowVersion: signatureResult.rowVersion, signatureId: signatureResult.signatureId };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
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
    scheduleDocumentRenderKick(finalizeResult.document.id);
    const documentUrl = `/api/documents/${finalizeResult.document.id}`;
    return {
      ok: true,
      collectionId: payload.collectionId,
      ...(documentUrl ? { documentUrl } : {}),
    };
  } catch (error: unknown) {
    return { ok: false, error: toFinalizeActionFailureCode(error) };
  }
}

export async function getCustomerAction(customerId: string): Promise<GetCustomerActionResult> {
  try {
    const loaded = await loadCustomerDto(customerId);
    if (!loaded.ok) {
      if (loaded.reason === "invalid_id" || loaded.reason === "not_found") {
        return { ok: false, error: "not_found" };
      }
      return { ok: false, error: "operation_failed" };
    }
    const customer = loaded.customer;
    return {
      ok: true,
      customer: {
        id: customer.id,
        displayName: customer.displayName,
        taxId: customer.taxId,
        phone: customer.phone,
        address: customer.address
          ? {
              street: customer.address.street,
              ...(customer.address.city === "" ? {} : { city: customer.address.city }),
              ...(customer.address.stateCode === "" ? {} : { stateCode: customer.address.stateCode }),
            }
          : null,
      },
    };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}

export async function discardDraftAction(payload: {
  collectionId: string;
  expectedVersion: number;
}): Promise<DiscardDraftActionResult> {
  try {
    return await discardCollectionDraft(payload.collectionId, payload.expectedVersion);
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
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
