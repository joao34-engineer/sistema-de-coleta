import "server-only";

import { z } from "zod";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";

const storageBucketSchema = z.enum(["collection-evidences", "collection-signatures"]);
const cleanupIntentRowSchema = z.object({
  intent_id: z.uuid().optional(),
  intentId: z.uuid().optional(),
  storage_path: z.string().min(1).optional(),
  storagePath: z.string().min(1).optional(),
  bucket: storageBucketSchema.optional(),
  bucket_id: storageBucketSchema.optional(),
  bucketId: storageBucketSchema.optional(),
  kind: z.enum(["evidence", "signature"]).optional(),
}).transform((value, context) => {
  const intentId = value.intent_id ?? value.intentId;
  const storagePath = value.storage_path ?? value.storagePath;
  if (!intentId || !storagePath) {
    context.addIssue({ code: "custom", message: "upload_cleanup_contract_invalid" });
    return z.NEVER;
  }
  const bucket = value.bucket ?? value.bucket_id ?? value.bucketId ?? (value.kind === "evidence" ? "collection-evidences" : value.kind === "signature" ? "collection-signatures" : undefined);
  return bucket ? { intentId, storagePath, bucket } : { intentId, storagePath };
});

const cleanupIntentRowsSchema = z.array(cleanupIntentRowSchema);
const stagingPathSchema = /^[0-9]+\/[0-9a-f-]{36}\/(?:staging\/)?[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/;

type DatabaseResponse = Readonly<{ data: unknown; error: unknown }>;
export type UploadCleanupBucket = z.infer<typeof storageBucketSchema>;

export type UploadCleanupClient = Readonly<{
  rpc(name: "expire_collection_upload_intents", args: Readonly<{ p_limit: number }>): Promise<DatabaseResponse>;
  rpc(name: "ack_collection_upload_cleanup", args: Readonly<{ p_intent_id: string }>): Promise<DatabaseResponse>;
  storage: Readonly<{
    from(bucket: UploadCleanupBucket): Readonly<{
      remove(paths: readonly string[]): Promise<Readonly<{ error: unknown }>>;
    }>;
  }>;
}>;

export type UploadCleanupSummary = Readonly<{
  expired: number;
  removed: number;
  acknowledged: number;
  failed: number;
}>;

function safePath(value: string): boolean {
  return value.length <= 512 && stagingPathSchema.test(value);
}

function logCleanupFailure(requestId: string, code: string): void {
  logTransactionFailure({ requestId, operation: "collection_upload_cleanup", code, actorId: null, status: 500 });
}

async function removeStagingObject(client: UploadCleanupClient, storagePath: string, bucket?: UploadCleanupBucket): Promise<boolean> {
  const buckets: readonly UploadCleanupBucket[] = bucket ? [bucket] : ["collection-evidences", "collection-signatures"];
  for (const candidate of buckets) {
    try {
      const removed = await client.storage.from(candidate).remove([storagePath]);
      if (removed.error) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function cleanupExpiredCollectionUploads(client: UploadCleanupClient, limit = 100, request?: Request): Promise<UploadCleanupSummary> {
  const requestId = getRequestId(request);
  const boundedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 1000)) : 100;
  let expiredResponse: DatabaseResponse;
  try {
    expiredResponse = await client.rpc("expire_collection_upload_intents", { p_limit: boundedLimit });
  } catch {
    logCleanupFailure(requestId, "cleanup_expire_rpc_failed");
    return { expired: 0, removed: 0, acknowledged: 0, failed: 1 };
  }
  if (expiredResponse.error) {
    logCleanupFailure(requestId, "cleanup_expire_rpc_failed");
    return { expired: 0, removed: 0, acknowledged: 0, failed: 1 };
  }
  const parsed = cleanupIntentRowsSchema.safeParse(expiredResponse.data);
  if (!parsed.success) {
    logCleanupFailure(requestId, "cleanup_expire_contract_invalid");
    return { expired: 0, removed: 0, acknowledged: 0, failed: 1 };
  }

  let removed = 0;
  let acknowledged = 0;
  let failed = 0;
  for (const intent of parsed.data) {
    if (!safePath(intent.storagePath)) {
      failed += 1;
      logCleanupFailure(requestId, "cleanup_storage_path_invalid");
      continue;
    }
    if (!await removeStagingObject(client, intent.storagePath, "bucket" in intent ? intent.bucket : undefined)) {
      failed += 1;
      logCleanupFailure(requestId, "cleanup_storage_remove_failed");
      continue;
    }
    removed += 1;
    let acknowledgedResponse: DatabaseResponse;
    try {
      acknowledgedResponse = await client.rpc("ack_collection_upload_cleanup", { p_intent_id: intent.intentId });
    } catch {
      failed += 1;
      logCleanupFailure(requestId, "cleanup_ack_rpc_failed");
      continue;
    }
    if (acknowledgedResponse.error || acknowledgedResponse.data !== true) {
      failed += 1;
      logCleanupFailure(requestId, "cleanup_ack_contract_invalid");
      continue;
    }
    acknowledged += 1;
  }
  return { expired: parsed.data.length, removed, acknowledged, failed };
}
