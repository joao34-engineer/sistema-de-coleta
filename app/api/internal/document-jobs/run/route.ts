import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";
import { isWorkerRequestAuthorized, runDocumentWorkerBatch } from "@/_pages/collection-documents/api/delivery/index.server";
import { jsonBody } from "@/_pages/collection-lifecycle/api/http-response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const batchBodySchema = z.object({ batchSize: z.number().int().min(1).max(5).default(5) }).strict();

async function runAuthorizedWorker(request: Request, batchSize: number) {
  if (!isWorkerRequestAuthorized(request)) {
    return noStoreJson({ error: { code: "forbidden", message: "Acesso não autorizado." } }, { status: 403 });
  }
  try {
    return noStoreJson({ data: await runDocumentWorkerBatch(batchSize) });
  } catch {
    return noStoreJson({ error: { code: "document_worker_failed", message: "Não foi possível executar o worker documental." } }, { status: 500 });
  }
}

/** Vercel Cron invokes GET with `Authorization: Bearer ${CRON_SECRET}`. */
export async function GET(request: Request) {
  return runAuthorizedWorker(request, 5);
}

export async function POST(request: Request) {
  const parsed = batchBodySchema.safeParse((await jsonBody(request)) ?? {});
  if (!parsed.success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  return runAuthorizedWorker(request, parsed.data.batchSize);
}
