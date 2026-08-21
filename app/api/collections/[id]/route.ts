import { z } from "zod";
import { getCollectionDetail, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/collections/[id]">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();
  try {
    return noStoreJson(await getCollectionDetail(id));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "get_collection_detail");
  }
}
