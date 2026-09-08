import "server-only";

import { timingSafeEqual } from "node:crypto";
import { runDocumentWorkerOnce } from "../rendering/worker.server";

function timingSafeEqualUtf8(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Accepts either manual worker secret (`X-Document-Worker-Secret`) or Vercel Cron
 * (`Authorization: Bearer ${CRON_SECRET}`). Both secrets must be ≥32 characters.
 */
export function isWorkerRequestAuthorized(request: Request): boolean {
  const workerSecret = process.env["DOCUMENT_WORKER_SECRET"];
  const providedWorker = request.headers.get("X-Document-Worker-Secret");
  if (
    typeof workerSecret === "string"
    && workerSecret.length >= 32
    && typeof providedWorker === "string"
    && timingSafeEqualUtf8(workerSecret, providedWorker)
  ) {
    return true;
  }

  const cronSecret = process.env["CRON_SECRET"];
  const authorization = request.headers.get("authorization");
  if (typeof cronSecret !== "string" || cronSecret.length < 32 || typeof authorization !== "string") {
    return false;
  }
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  return timingSafeEqualUtf8(cronSecret, authorization.slice(prefix.length));
}

export async function runDocumentWorkerBatch(
  batchSize: number,
  documentId?: string,
): Promise<Readonly<{ processed: number; statuses: ReadonlyArray<"idle" | "succeeded" | "retry_scheduled" | "failed"> }>> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) throw new RangeError("document_worker_batch_size_invalid");
  const statuses: Array<"idle" | "succeeded" | "retry_scheduled" | "failed"> = [];
  for (let index = 0; index < batchSize; index += 1) {
    const result = await runDocumentWorkerOnce(documentId);
    statuses.push(result.status);
    if (result.status === "idle") break;
  }
  return { processed: statuses.filter((status) => status !== "idle").length, statuses };
}

/**
 * After finalize (and similar) already enqueued jobs, render PDF/QR in this process.
 * Pass `documentId` so the kick claims that guia's jobs, not leftover FIFO rows.
 * Cron still calls `runDocumentWorkerBatch` without an id. Failures must not undo finalize.
 */
export async function processQueuedDocumentRenders(
  documentId?: string,
  runBatch: typeof runDocumentWorkerBatch = runDocumentWorkerBatch,
): Promise<void> {
  try {
    await runBatch(2, documentId);
  } catch {
    return;
  }
}
