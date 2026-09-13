import { z } from "zod";
import { apiErrorResponse, getCollectionDetail, noStoreJson, toLifecycleApiError, validationErrorResponse } from "@/_pages/collection-lifecycle/index.server";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/collections/[id]">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return validationErrorResponse();
  try {
    const collection = await getCollectionDetail(id);
    if (collection === null) {
      return apiErrorResponse(
        { status: 404, code: "collection_not_found", message: "Coleta não encontrada." },
        getRequestId(request),
        "get_collection_detail",
      );
    }
    return noStoreJson(collection);
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "get_collection_detail");
  }
}
