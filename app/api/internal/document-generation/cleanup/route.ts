import { isWorkerRequestAuthorized } from "@/_pages/collection-documents/api/delivery/index.server";
import { cleanupExpiredDocumentRenderIntents } from "@/_pages/collection-documents/api/rendering/cleanup.server";
import { jsonBody, noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request)) return noStoreJson({ error: { code: "forbidden", message: "Acesso não autorizado." } }, { status: 403 });
  const parsed = z.object({ limit: z.number().int().min(1).max(1000).default(100) }).strict().safeParse((await jsonBody(request)) ?? {});
  if (!parsed.success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    return noStoreJson({ data: await cleanupExpiredDocumentRenderIntents(parsed.data.limit) });
  } catch {
    return noStoreJson({ error: { code: "document_cleanup_failed", message: "Não foi possível limpar os uploads documentais expirados." } }, { status: 500 });
  }
}
