import { z } from "zod";
import { workshopCheckInSchema, workshopCheckIn, toOperationsApiError, validatePngSignature } from "@/_pages/collection-operations/index.server";
import { parseJsonFormField } from "@/_pages/collection-operations/model/workshop-rpc-items";
import { apiErrorResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/workshop-checkin">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();

  const formData = await request.formData();
  const parsed = workshopCheckInSchema.safeParse({
    collectionId: id,
    expectedVersion: Number(formData.get("expectedVersion")),
    administratorName: formData.get("administratorName"),
    administratorTaxId: formData.get("administratorTaxId"),
    items: parseJsonFormField(formData.get("items")),
    signatureIntentId: formData.get("signatureIntentId"),
  });
  const file = formData.get("signature");

  if (!parsed.success || !validatePngSignature(file)) return validationErrorResponse();

  try {
    return noStoreJson(await workshopCheckIn(id, parsed.data, file, getRequestId(request)));
  } catch (error: unknown) {
    return apiErrorResponse(toOperationsApiError(error), getRequestId(request), "workshop_check_in");
  }
}
