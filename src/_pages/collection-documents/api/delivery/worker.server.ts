import "server-only";

import { timingSafeEqual } from "node:crypto";
import { runDocumentWorkerOnce } from "../rendering/worker.server";

export function isWorkerRequestAuthorized(request: Request): boolean {
  const expected = process.env["DOCUMENT_WORKER_SECRET"];
  const provided = request.headers.get("X-Document-Worker-Secret");
  if (typeof expected !== "string" || expected.length < 32 || typeof provided !== "string") return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function runDocumentWorkerBatch(batchSize: number): Promise<Readonly<{ processed: number; statuses: ReadonlyArray<"idle" | "succeeded" | "retry_scheduled" | "failed"> }>> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) throw new RangeError("document_worker_batch_size_invalid");
  const statuses: Array<"idle" | "succeeded" | "retry_scheduled" | "failed"> = [];
  for (let index = 0; index < batchSize; index += 1) {
    const result = await runDocumentWorkerOnce();
    statuses.push(result.status);
    if (result.status === "idle") break;
  }
  return { processed: statuses.filter((status) => status !== "idle").length, statuses };
}
