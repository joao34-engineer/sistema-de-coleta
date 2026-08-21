import "server-only";

import { z } from "zod";
import { createDocumentArtifactStorage, type DocumentArtifactStorage } from "./storage.server";
import { createPhaseTwoServiceClient, type PhaseTwoSupabaseClient } from "./server-client";
import { documentRenderUploadCleanupAckSchema, type ArtifactDraft } from "./generation-contracts";

const cleanupIntentSchema = z.object({
  intentId: z.uuid(),
  storagePath: z.string().regex(/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/),
  bucket: z.literal("collection-documents"),
}).strict();

const cleanupIntentsSchema = z.array(cleanupIntentSchema);
const MAX_CLEANUP_LIMIT = 1_000;

export type CleanupResult = Readonly<{ scanned: number; removed: number; failed: number }>;

export type DocumentRenderCleanupDependencies = Readonly<{
  client: PhaseTwoSupabaseClient;
  storage: DocumentArtifactStorage;
}>;

function cleanupLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_CLEANUP_LIMIT) throw new RangeError("cleanup_limit_invalid");
  return value;
}

function draftForExpiredIntent(intent: z.output<typeof cleanupIntentSchema>): ArtifactDraft {
  const match = /^(?:[0-9]+)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|png)$/.exec(intent.storagePath);
  if (!match || !match[1] || !match[2] || !match[3]) throw new Error("document_storage_path_invalid");
  const artifactType = match[3] === "pdf" ? "pdf" : "qr";
  return {
    artifactId: null,
    intentId: intent.intentId,
    documentId: match[1],
    artifactType,
    contentType: artifactType === "pdf" ? "application/pdf" : "image/png",
    byteSize: 1,
    sha256: "0".repeat(64),
    storagePath: intent.storagePath,
  };
}

async function acknowledgeCleanup(
  client: PhaseTwoSupabaseClient,
  intent: z.output<typeof cleanupIntentSchema>,
): Promise<void> {
  const { data, error } = await client.rpc("ack_document_render_upload_cleanup", { p_intent_id: intent.intentId });
  if (error) throw error;
  documentRenderUploadCleanupAckSchema.parse(data);
}

export async function cleanupExpiredDocumentRenderIntents(
  limit = 100,
  dependencies: DocumentRenderCleanupDependencies = {
    client: createPhaseTwoServiceClient(),
    storage: createDocumentArtifactStorage(),
  },
): Promise<CleanupResult> {
  const boundedLimit = cleanupLimit(limit);
  const { data, error } = await dependencies.client.rpc("cleanup_document_render_upload_intents", { p_limit: boundedLimit });
  if (error) throw error;
  const intents = cleanupIntentsSchema.parse(data);
  let removed = 0;
  let failed = 0;
  for (const intent of intents) {
    try {
      const draft = draftForExpiredIntent(intent);
      await dependencies.storage.remove(draft);
      await acknowledgeCleanup(dependencies.client, intent);
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: intents.length, removed, failed };
}
