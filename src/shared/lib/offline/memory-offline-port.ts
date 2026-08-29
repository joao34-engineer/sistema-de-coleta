import { OfflineQuotaExceededError, type OfflineDatabaseSchema, type OfflineKvPort } from "./offline-kv-port";

function recordKey(record: unknown, keyPath: string): string | null {
  if (typeof record !== "object" || record === null || !(keyPath in record)) {
    return null;
  }
  const value = record[keyPath as keyof typeof record];
  return typeof value === "string" ? value : null;
}

function recordIndexValue(record: unknown, keyPath: string): string | null {
  return recordKey(record, keyPath);
}

export function createMemoryOfflinePort(schema: OfflineDatabaseSchema): OfflineKvPort {
  const tables = new Map<string, Map<string, unknown>>();
  for (const store of schema.stores) {
    tables.set(store.name, new Map());
  }

  function table(storeName: string): Map<string, unknown> {
    const existing = tables.get(storeName);
    if (!existing) {
      throw new Error(`unknown_offline_store:${storeName}`);
    }
    return existing;
  }

  function keyPathFor(storeName: string): string {
    const store = schema.stores.find((candidate) => candidate.name === storeName);
    if (!store) {
      throw new Error(`unknown_offline_store:${storeName}`);
    }
    return store.keyPath;
  }

  function indexKeyPath(storeName: string, indexName: string): string {
    const store = schema.stores.find((candidate) => candidate.name === storeName);
    const index = store?.indexes?.find((candidate) => candidate.name === indexName);
    if (!index) {
      throw new Error(`unknown_offline_index:${storeName}:${indexName}`);
    }
    return index.keyPath;
  }

  return {
    async get(storeName, key) {
      return table(storeName).get(key) ?? null;
    },
    async put(storeName, record) {
      const key = recordKey(record, keyPathFor(storeName));
      if (key === null) {
        throw new Error("offline_record_key_missing");
      }
      table(storeName).set(key, record);
    },
    async delete(storeName, key) {
      table(storeName).delete(key);
    },
    async getAll(storeName) {
      return [...table(storeName).values()];
    },
    async getAllByIndex(storeName, indexName, value) {
      const path = indexKeyPath(storeName, indexName);
      return [...table(storeName).values()].filter((record) => recordIndexValue(record, path) === value);
    },
  };
}

export function createThrowingQuotaPort(schema: OfflineDatabaseSchema): OfflineKvPort {
  const inner = createMemoryOfflinePort(schema);
  return {
    get: inner.get.bind(inner),
    delete: inner.delete.bind(inner),
    getAll: inner.getAll.bind(inner),
    getAllByIndex: inner.getAllByIndex.bind(inner),
    async put() {
      throw new OfflineQuotaExceededError();
    },
  };
}
