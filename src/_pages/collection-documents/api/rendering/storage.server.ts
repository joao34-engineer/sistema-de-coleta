import "server-only";

import { createPhaseTwoServiceClient, type PhaseTwoSupabaseClient } from "./server-client";
import type { ArtifactDraft } from "./generation-contracts";
import { sha256Hex } from "./canonical-json";

export type DocumentArtifactStorage = Readonly<{
  upload(draft: ArtifactDraft, bytes: Uint8Array): Promise<void>;
  remove(draft: ArtifactDraft): Promise<void>;
}>;

function assertSafePath(path: string): void {
  if (!/^[0-9]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png)$/.test(path)) throw new Error("document_storage_path_invalid");
}

export function createDocumentArtifactStorage(client: PhaseTwoSupabaseClient = createPhaseTwoServiceClient()): DocumentArtifactStorage {
  return {
    async upload(draft, bytes) {
      assertSafePath(draft.storagePath);
      if (draft.intentId === null || draft.artifactId !== null) throw new Error("document_upload_intent_invalid");
      if (bytes.byteLength !== draft.byteSize || sha256Hex(bytes) !== draft.sha256) throw new Error("document_artifact_metadata_mismatch");
      const { error } = await client.storage.from("collection-documents").upload(draft.storagePath, bytes, { contentType: draft.artifactType === "pdf" ? "application/pdf" : "image/png", upsert: false });
      if (error) throw error;
    },
    async remove(draft) {
      assertSafePath(draft.storagePath);
      const { error } = await client.storage.from("collection-documents").remove([draft.storagePath]);
      if (error) throw error;
    },
  };
}
