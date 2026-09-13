import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";
import { validateEvidenceFile } from "@/shared/lib/file/file-validation";
import { actorIdFromUnknown, getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import {
  collectionIdSchema,
  draftCreateSchema,
  draftPatchSchema,
  expectedVersionSchema,
  itemCreateCommandSchema,
  itemIdSchema,
  itemPatchCommandSchema,
} from "../model/draft";
import {
  addItem as addItemCommand,
  createDraft as createDraftCommand,
  patchDraft as patchDraftCommand,
  patchItem as patchItemCommand,
  removeItem as removeItemCommand,
  uploadEvidence as uploadEvidenceCommand,
} from "./commands";
import { databaseErrorCode, databaseErrorMessage } from "./draft-db";
import { getDraft as getDraftQuery } from "./queries";

const SERVER_FAILURE_CODES = new Set([
  "draft_query_failed",
  "draft_update_contract_invalid",
  "item_create_contract_invalid",
  "item_update_contract_invalid",
  "item_remove_contract_invalid",
  "evidence_prepare_contract_invalid",
  "evidence_upload_failed",
  "evidence_commit_contract_invalid",
]);

function respond(status: number, body: unknown): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function errorResponse(error: unknown, request: Request, operation: string, actorId: string | null): NextResponse {
  if (error instanceof AuthenticationRequiredError) return respond(401, { ok: false, code: "authentication_required" });
  if (error instanceof AdministratorAccessDeniedError) return respond(403, { ok: false, code: "forbidden" });
  if (error instanceof Error && error.message === "validation_error") return respond(400, { ok: false, code: "validation_error" });
  if (error instanceof Error && error.message === "invalid_file") return respond(400, { ok: false, code: "invalid_file" });
  if (error instanceof Error && error.message === "not_found") return respond(404, { ok: false, code: "not_found" });
  if (error instanceof Error && error.message === "draft_create_conflict") return respond(409, { ok: false, code: "draft_create_conflict" });
  if (error instanceof Error && SERVER_FAILURE_CODES.has(error.message)) {
    logTransactionFailure({ requestId: getRequestId(request), operation, code: error.message, actorId: actorIdFromUnknown(error) ?? actorId, status: 500 });
    return respond(500, { ok: false, code: error.message });
  }
  const code = databaseErrorCode(error);
  if (code === "40001" || databaseErrorMessage(error) === "stale_version" || (error instanceof Error && error.message === "stale_version")) {
    return respond(409, { ok: false, code: "stale_version" });
  }
  if (code === "42501") return respond(403, { ok: false, code: "forbidden" });
  logTransactionFailure({ requestId: getRequestId(request), operation, code: "draft_unexpected_error", actorId: actorIdFromUnknown(error) ?? actorId, status: 500 });
  return respond(500, { ok: false, code: "unexpected_error" });
}

function rpcErrorResponse(error: unknown, request: Request, operation: string, actorId: string | null): NextResponse {
  const code = databaseErrorCode(error);
  const message = databaseErrorMessage(error) ?? (error instanceof Error ? error.message : null);
  if (code === "40001" || message === "stale_version") return respond(409, { ok: false, code: "stale_version" });
  if (code === "42501") return respond(403, { ok: false, code: "forbidden" });
  if (code === "P0001" && message === "collection_not_draft") return respond(409, { ok: false, code: "collection_not_draft" });
  if (code === "P0001" && message === "collection_item_not_found") return respond(404, { ok: false, code: "not_found" });
  if (code === "P0001" && message === "collection_item_mismatch") return respond(422, { ok: false, code: "collection_item_mismatch" });
  if (code === "P0001" && message === "invalid_expected_version") return respond(422, { ok: false, code: "validation_error" });
  if (code === "P0001" && message === "invalid_signer_tax_id") return respond(422, { ok: false, code: "invalid_signer_tax_id" });
  if (SERVER_FAILURE_CODES.has(message ?? "")) {
    return errorResponse(error, request, operation, actorId);
  }
  logTransactionFailure({ requestId: getRequestId(request), operation, code: code ?? `${operation}_failed`, actorId: actorIdFromUnknown(error) ?? actorId, status: 500 });
  return respond(500, { ok: false, code: `${operation}_failed` });
}

function commandErrorResponse(error: unknown, request: Request, operation: string): NextResponse {
  const actorId = actorIdFromUnknown(error);
  if (error instanceof Error && SERVER_FAILURE_CODES.has(error.message)) {
    return errorResponse(error, request, operation, actorId);
  }
  if (databaseErrorCode(error) !== null || (error instanceof Error && error.message === "stale_version")) {
    return rpcErrorResponse(error, request, operation, actorId);
  }
  return errorResponse(error, request, operation, actorId);
}

export async function createDraft(request: Request): Promise<NextResponse> {
  try {
    const input = draftCreateSchema.safeParse(await json(request));
    if (!input.success) return respond(400, { ok: false, code: "validation_error", issues: input.error.flatten() });
    const created = await createDraftCommand(input.data);
    return respond(created.idempotent ? 200 : 201, { ok: true, data: { draft: created.draft, idempotent: created.idempotent } });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "create_draft");
  }
}

export async function getDraft(id: string, request: Request): Promise<NextResponse> {
  try {
    const data = await getDraftQuery(id);
    return respond(200, { ok: true, data });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "get_draft");
  }
}

export async function patchDraft(request: Request, id: string): Promise<NextResponse> {
  try {
    const parsedId = collectionIdSchema.safeParse(id);
    const input = draftPatchSchema.safeParse(await json(request));
    if (!input.success && zodIssueTouchesKey(input.error, "responsibleTaxId")) {
      return respond(422, { ok: false, code: "invalid_signer_tax_id" });
    }
    if (!parsedId.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const draft = await patchDraftCommand(parsedId.data, input.data);
    return respond(200, { ok: true, data: { draft } });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "draft_update");
  }
}

export async function addItem(request: Request, collectionId: string): Promise<NextResponse> {
  try {
    const id = collectionIdSchema.safeParse(collectionId);
    const input = itemCreateCommandSchema.safeParse(await json(request));
    if (!id.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const data = await addItemCommand(id.data, input.data);
    return respond(201, { ok: true, data });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "item_create");
  }
}

export async function patchItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId);
    const item = itemIdSchema.safeParse(itemId);
    const input = itemPatchCommandSchema.safeParse(await json(request));
    if (!collection.success || !item.success || !input.success) return respond(400, { ok: false, code: "validation_error", issues: input.success ? undefined : input.error.flatten() });
    const data = await patchItemCommand(collection.data, item.data, input.data);
    return respond(200, { ok: true, data });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "item_update");
  }
}

export async function removeItem(request: Request, collectionId: string, itemId: string): Promise<NextResponse> {
  try {
    const collection = collectionIdSchema.safeParse(collectionId);
    const item = itemIdSchema.safeParse(itemId);
    const input = expectedVersionSchema.safeParse(await json(request));
    if (!collection.success || !item.success || !input.success) return respond(400, { ok: false, code: "validation_error" });
    const data = await removeItemCommand(collection.data, item.data, input.data.expectedVersion);
    return respond(200, { ok: true, data });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "item_remove");
  }
}

export async function uploadEvidence(request: Request, collectionId: string): Promise<NextResponse> {
  try {
    const id = collectionIdSchema.safeParse(collectionId);
    if (!id.success) return respond(400, { ok: false, code: "validation_error" });
    const formData = await request.formData();
    const expectedVersion = z.coerce.number().int().positive().safeParse(formData.get("expectedVersion"));
    const itemValue = formData.get("itemId");
    const parsedItemId = itemValue === null || itemValue === "" ? null : itemIdSchema.safeParse(itemValue);
    if (!expectedVersion.success || (parsedItemId !== null && !parsedItemId.success)) return respond(400, { ok: false, code: "validation_error" });
    const file = formData.get("file");
    const fileValidation = await validateEvidenceFile(file);
    if (!fileValidation.valid || !(file instanceof File)) return respond(400, { ok: false, code: "invalid_file" });
    const data = await uploadEvidenceCommand(
      id.data,
      file,
      { expectedVersion: expectedVersion.data, itemId: parsedItemId === null ? null : parsedItemId.data },
      getRequestId(request),
    );
    return respond(201, { ok: true, data });
  } catch (error: unknown) {
    return commandErrorResponse(error, request, "upload_evidence");
  }
}
