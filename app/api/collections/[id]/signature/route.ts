import { z } from "zod";
import { saveCollectionSignature, signatureInputSchema, toLifecycleApiError, validatePngSignature } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, invalidSignerTaxIdResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/collections/[id]/signature">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();
  const formData = await request.formData();
  const parsed = signatureInputSchema.safeParse({ signerName: formData.get("signerName"), signerTaxId: formData.get("signerTaxId"), acceptanceText: formData.get("acceptanceText"), expectedVersion: formData.get("expectedVersion") });
  const file = formData.get("signature");
  if (!parsed.success) {
    if (zodIssueTouchesKey(parsed.error, "signerTaxId")) return invalidSignerTaxIdResponse();
    return validationErrorResponse();
  }
  if (!validatePngSignature(file)) return validationErrorResponse();
  try {
    return noStoreJson(await saveCollectionSignature(id, parsed.data, file, getRequestId(request)));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "save_collection_signature");
  }
}
