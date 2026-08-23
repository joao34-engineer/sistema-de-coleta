import { z } from "zod";
import { customerDeliverySchema, deliverToCustomer, toOperationsApiError, validatePngSignature } from "@/_pages/collection-operations/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/delivery">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();

  const formData = await request.formData();
  const parsed = customerDeliverySchema.safeParse({
    collectionId: id,
    expectedVersion: Number(formData.get("expectedVersion")),
    deliveredItemIds: JSON.parse(formData.get("deliveredItemIds") as string),
    receiverName: formData.get("receiverName"),
    receiverTaxId: formData.get("receiverTaxId"),
    notes: formData.get("notes"),
    signatureIntentId: formData.get("signatureIntentId"),
  });
  const file = formData.get("signature");

  if (!parsed.success || !validatePngSignature(file)) return validationErrorResponse();

  try {
    return noStoreJson(await deliverToCustomer(id, parsed.data, file, getRequestId(request)));
  } catch (error: unknown) {
    return apiErrorResponse(toOperationsApiError(error), getRequestId(request), "customer_delivery");
  }
}
