import { z } from "zod";
import { budgetApprovalSchema, budgetApproval, toOperationsApiError } from "@/_pages/collection-operations/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse, idempotencyKeyFrom, idempotencyKeyRequiredResponse, jsonBody } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/budget-approval">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();

  const idempotencyKey = idempotencyKeyFrom(request);
  if (idempotencyKey === null) return idempotencyKeyRequiredResponse();

  const body = await jsonBody(request);
  const parsed = budgetApprovalSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse();

  try {
    return noStoreJson(await budgetApproval(id, parsed.data, idempotencyKey));
  } catch (error: unknown) {
    return apiErrorResponse(toOperationsApiError(error), getRequestId(request), "budget_approval");
  }
}
