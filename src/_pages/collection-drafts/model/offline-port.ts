import {
  createIndexedDbPort,
  createMemoryOfflinePort,
  openIndexedDb,
  type OfflineKvPort,
} from "@/shared/lib/offline";
import { offlineDatabaseSchema } from "./offline-records";
import { createOfflineDraftStore, type OfflineDraftStore } from "./offline-store";

let port: OfflineKvPort | null = null;
let store: OfflineDraftStore | null = null;
let opening: Promise<OfflineKvPort> | null = null;

export function setOfflinePortForTests(next: OfflineKvPort): void {
  port = next;
  store = createOfflineDraftStore(next);
  opening = null;
}

export function resetOfflinePortForTests(): void {
  port = null;
  store = null;
  opening = null;
}

export function getOfflineDraftStore(): OfflineDraftStore {
  if (store === null) {
    throw new Error("offline_store_not_ready");
  }
  return store;
}

export async function ensureOfflinePort(): Promise<OfflineKvPort> {
  if (port) {
    return port;
  }
  if (typeof indexedDB === "undefined") {
    const memory = createMemoryOfflinePort(offlineDatabaseSchema);
    port = memory;
    store = createOfflineDraftStore(memory);
    return memory;
  }
  if (!opening) {
    opening = openIndexedDb(offlineDatabaseSchema)
      .then((database) => {
        const indexed = createIndexedDbPort(database);
        port = indexed;
        store = createOfflineDraftStore(indexed);
        return indexed;
      })
      .catch((error: unknown) => {
        opening = null;
        throw error;
      });
  }
  return opening;
}

export async function ensureOfflineDraftStore(): Promise<OfflineDraftStore> {
  await ensureOfflinePort();
  return getOfflineDraftStore();
}
