import type { OfflineKvPort } from "@/shared/lib/offline";
import { setOfflineSnapshot, type OfflineSnapshot } from "./offline-snapshot";
import {
  OFFLINE_BLOBS_STORE,
  OFFLINE_DRAFTS_STORE,
  OFFLINE_ITEMS_STORE,
  OFFLINE_MUTATIONS_STORE,
  offlineBlobRecordSchema,
  offlineDraftRecordSchema,
  offlineItemRecordSchema,
  offlineMutationRecordSchema,
  type MutationKind,
  type OfflineBlobRecord,
  type OfflineDraftRecord,
  type OfflineItemRecord,
  type OfflineMutationRecord,
} from "./offline-records";

function nowIso(): string {
  return new Date().toISOString();
}

function parseDraft(value: unknown, userId: string): OfflineDraftRecord | null {
  const parsed = offlineDraftRecordSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== userId) {
    return null;
  }
  return parsed.data;
}

function parseItem(value: unknown, userId: string): OfflineItemRecord | null {
  const parsed = offlineItemRecordSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== userId) {
    return null;
  }
  return parsed.data;
}

function parseMutation(value: unknown, userId: string): OfflineMutationRecord | null {
  const parsed = offlineMutationRecordSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== userId) {
    return null;
  }
  return parsed.data;
}

function parseBlob(value: unknown, userId: string): OfflineBlobRecord | null {
  const parsed = offlineBlobRecordSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== userId) {
    return null;
  }
  return parsed.data;
}

function signatureBlobId(collectionId: string): string {
  return `${collectionId}:signature`;
}

export function createOfflineDraftStore(port: OfflineKvPort) {
  async function putDraft(record: OfflineDraftRecord): Promise<void> {
    await port.put(OFFLINE_DRAFTS_STORE, record);
  }

  async function getDraft(id: string, userId: string): Promise<OfflineDraftRecord | null> {
    return parseDraft(await port.get(OFFLINE_DRAFTS_STORE, id), userId);
  }

  async function listDrafts(userId: string): Promise<readonly OfflineDraftRecord[]> {
    const rows = await port.getAllByIndex(OFFLINE_DRAFTS_STORE, "userId", userId);
    return rows
      .map((row) => parseDraft(row, userId))
      .filter((row): row is OfflineDraftRecord => row !== null);
  }

  async function listItems(collectionId: string, userId: string): Promise<readonly OfflineItemRecord[]> {
    const rows = await port.getAllByIndex(OFFLINE_ITEMS_STORE, "collectionId", collectionId);
    return rows
      .map((row) => parseItem(row, userId))
      .filter((row): row is OfflineItemRecord => row !== null)
      .filter((row) => !row.removed)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function putItem(record: OfflineItemRecord): Promise<void> {
    await port.put(OFFLINE_ITEMS_STORE, record);
  }

  async function listMutations(collectionId: string, userId: string): Promise<readonly OfflineMutationRecord[]> {
    const rows = await port.getAllByIndex(OFFLINE_MUTATIONS_STORE, "collectionId", collectionId);
    return rows
      .map((row) => parseMutation(row, userId))
      .filter((row): row is OfflineMutationRecord => row !== null)
      .sort((left, right) => left.sequence - right.sequence);
  }

  async function listPendingMutations(userId: string): Promise<readonly OfflineMutationRecord[]> {
    const rows = await port.getAll(OFFLINE_MUTATIONS_STORE);
    return rows
      .map((row) => parseMutation(row, userId))
      .filter((row): row is OfflineMutationRecord => row !== null)
      .filter((row) => row.status === "pending" || row.status === "failed" || row.status === "in_flight")
      .sort((left, right) => left.sequence - right.sequence || left.createdAt.localeCompare(right.createdAt));
  }

  async function putMutation(record: OfflineMutationRecord): Promise<void> {
    await port.put(OFFLINE_MUTATIONS_STORE, record);
  }

  async function enqueue(input: {
    collectionId: string;
    userId: string;
    kind: MutationKind;
    payload: unknown;
  }): Promise<OfflineMutationRecord> {
    const existing = await listMutations(input.collectionId, input.userId);
    if (input.kind === "discard_draft") {
      const leftover = existing.find(
        (row) =>
          row.kind === "discard_draft" &&
          (row.status === "pending" || row.status === "failed" || row.status === "in_flight"),
      );
      if (leftover) {
        return leftover;
      }
    }
    const sequence = existing.reduce((max, row) => Math.max(max, row.sequence), -1) + 1;
    const record: OfflineMutationRecord = {
      id: crypto.randomUUID(),
      collectionId: input.collectionId,
      userId: input.userId,
      sequence,
      kind: input.kind,
      payload: input.payload,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: nowIso(),
    };
    await putMutation(record);
    return record;
  }

  async function putSignature(record: Omit<OfflineBlobRecord, "id" | "kind"> & { kind?: "signature" }): Promise<void> {
    const blob: OfflineBlobRecord = {
      id: signatureBlobId(record.collectionId),
      collectionId: record.collectionId,
      userId: record.userId,
      kind: "signature",
      dataUrl: record.dataUrl,
    };
    await port.put(OFFLINE_BLOBS_STORE, blob);
  }

  async function getSignature(collectionId: string, userId: string): Promise<OfflineBlobRecord | null> {
    return parseBlob(await port.get(OFFLINE_BLOBS_STORE, signatureBlobId(collectionId)), userId);
  }

  async function deleteDraftTree(collectionId: string, userId: string): Promise<void> {
    const draft = await getDraft(collectionId, userId);
    if (draft === null) {
      return;
    }
    const items = await port.getAllByIndex(OFFLINE_ITEMS_STORE, "collectionId", collectionId);
    for (const row of items) {
      const item = parseItem(row, userId);
      if (item) {
        await port.delete(OFFLINE_ITEMS_STORE, item.id);
      }
    }
    const mutations = await listMutations(collectionId, userId);
    for (const mutation of mutations) {
      await port.delete(OFFLINE_MUTATIONS_STORE, mutation.id);
    }
    await port.delete(OFFLINE_BLOBS_STORE, signatureBlobId(collectionId));
    await port.delete(OFFLINE_DRAFTS_STORE, collectionId);
  }

  async function refreshSnapshot(userId: string, draining = false): Promise<OfflineSnapshot> {
    const drafts = await listDrafts(userId);
    const mutations = await listPendingMutations(userId);
    const pendingIds = new Set<string>([
      ...drafts.filter((draft) => draft.syncStatus !== "synced").map((draft) => draft.id),
      ...mutations.filter((row) => row.status !== "done").map((row) => row.collectionId),
    ]);
    const next: OfflineSnapshot = {
      pendingCount: pendingIds.size,
      failedCount: drafts.filter((draft) => draft.syncStatus === "failed").length,
      draining,
    };
    setOfflineSnapshot(next);
    return next;
  }

  return {
    putDraft,
    getDraft,
    listDrafts,
    listItems,
    putItem,
    listMutations,
    listPendingMutations,
    putMutation,
    enqueue,
    putSignature,
    getSignature,
    deleteDraftTree,
    refreshSnapshot,
    nowIso,
  };
}

export type OfflineDraftStore = ReturnType<typeof createOfflineDraftStore>;
