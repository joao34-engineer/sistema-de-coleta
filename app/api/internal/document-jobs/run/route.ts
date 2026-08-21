import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";
import { isWorkerRequestAuthorized, runDocumentWorkerBatch } from "@/_pages/collection-documents/api/delivery/index.server";
import { jsonBody } from "@/_pages/collection-lifecycle/api/http-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request)) return noStoreJson({ error: { code: "forbidden", message: "Acesso não autorizado." } }, { status: 403 });
  const parsed = z.object({ batchSize: z.number().int().min(1).max(5).default(5) }).strict().safeParse((await jsonBody(request)) ?? {});
  if (!parsed.success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    return noStoreJson({ data: await runDocumentWorkerBatch(parsed.data.batchSize) });
  } catch {
    return noStoreJson({ error: { code: "document_worker_failed", message: "Não foi possível executar o worker documental." } }, { status: 500 });
  }
}
