export type OfflineStoreIndex = Readonly<{
  name: string;
  keyPath: string;
}>;

export type OfflineStoreSchema = Readonly<{
  name: string;
  keyPath: string;
  indexes?: readonly OfflineStoreIndex[];
}>;

export type OfflineDatabaseSchema = Readonly<{
  name: string;
  version: number;
  stores: readonly OfflineStoreSchema[];
}>;

export type OfflineKvPort = {
  get(storeName: string, key: string): Promise<unknown>;
  put(storeName: string, record: unknown): Promise<void>;
  delete(storeName: string, key: string): Promise<void>;
  getAll(storeName: string): Promise<readonly unknown[]>;
  getAllByIndex(storeName: string, indexName: string, value: string): Promise<readonly unknown[]>;
};

export class OfflineQuotaExceededError extends Error {
  constructor() {
    super("offline_quota_exceeded");
    this.name = "OfflineQuotaExceededError";
  }
}

export function isOfflineQuotaExceeded(error: unknown): boolean {
  if (error instanceof OfflineQuotaExceededError) {
    return true;
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "QuotaExceededError") {
    return true;
  }
  return false;
}
