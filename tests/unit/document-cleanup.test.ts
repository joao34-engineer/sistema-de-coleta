import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredDocumentRenderIntents } from "@/_pages/collection-documents/api/rendering/cleanup.server";
import type { DocumentArtifactStorage } from "@/_pages/collection-documents/api/rendering/storage.server";
import type { PhaseTwoSupabaseClient } from "@/_pages/collection-documents/api/rendering/server-client";

const intent = {
  intentId: "11111111-1111-4111-8111-111111111111",
  storagePath: "1/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.pdf",
  bucket: "collection-documents" as const,
};

const acknowledged = {
  intentId: intent.intentId,
  status: "expired" as const,
  storagePath: intent.storagePath,
  acknowledged: true as const,
};

function fakeClient(
  calls: Array<Readonly<{ name: string; args: Readonly<Record<string, unknown>> }>>,
): PhaseTwoSupabaseClient {
  const client = {
    rpc(name: string, args: Readonly<Record<string, unknown>>) {
      calls.push({ name, args });
      if (name === "cleanup_document_render_upload_intents") return Promise.resolve({ data: [intent], error: null });
      return Promise.resolve({ data: acknowledged, error: null });
    },
  };
  return client as unknown as PhaseTwoSupabaseClient;
}

function fakeStorage(remove: DocumentArtifactStorage["remove"]): DocumentArtifactStorage {
  return { upload: vi.fn(async () => undefined), remove };
}

describe("document render cleanup", () => {
  it("acknowledges an intent only after Storage removal succeeds", async () => {
    const calls: Array<Readonly<{ name: string; args: Readonly<Record<string, unknown>> }>> = [];
    const result = await cleanupExpiredDocumentRenderIntents(1, {
      client: fakeClient(calls),
      storage: fakeStorage(vi.fn(async () => undefined)),
    });

    expect(result).toEqual({ scanned: 1, removed: 1, failed: 0 });
    expect(calls.map((call) => call.name)).toEqual([
      "cleanup_document_render_upload_intents",
      "ack_document_render_upload_cleanup",
    ]);
    expect(calls[1]?.args).toEqual({ p_intent_id: intent.intentId });
  });

  it("does not acknowledge when Storage removal fails, leaving the intent retryable", async () => {
    const calls: Array<Readonly<{ name: string; args: Readonly<Record<string, unknown>> }>> = [];
    const result = await cleanupExpiredDocumentRenderIntents(1, {
      client: fakeClient(calls),
      storage: fakeStorage(vi.fn(async () => { throw new Error("storage_unavailable"); })),
    });

    expect(result).toEqual({ scanned: 1, removed: 0, failed: 1 });
    expect(calls.map((call) => call.name)).toEqual(["cleanup_document_render_upload_intents"]);
  });
});
