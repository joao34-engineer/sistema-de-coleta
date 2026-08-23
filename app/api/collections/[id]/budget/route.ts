import { z } from "zod";
import { technicalBudgetSchema, saveTechnicalBudget, toOperationsApiError } from "@/_pages/collection-operations/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse, idempotencyKeyFrom, idempotencyKeyRequiredResponse, jsonBody } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/budget">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();

  const idempotencyKey = idempotencyKeyFrom(request);
  if (idempotencyKey === null) return idempotencyKeyRequiredResponse();

  const body = await jsonBody(request);
  const parsed = technicalBudgetSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse();

  try {
    return noStoreJson(await saveTechnicalBudget(id, parsed.data, idempotencyKey));
  } catch (error: unknown) {
    return apiErrorResponse(toOperationsApiError(error), getRequestId(request), "save_technical_budget");
  }
}
