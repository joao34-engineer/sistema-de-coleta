import {
  OfflineQuotaExceededError,
  type OfflineDatabaseSchema,
  type OfflineKvPort,
} from "./offline-kv-port";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("indexeddb_request_failed"));
    };
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("indexeddb_transaction_failed"));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    };
  });
}

export async function openIndexedDb(schema: OfflineDatabaseSchema): Promise<IDBDatabase> {
  const request = indexedDB.open(schema.name, schema.version);
  request.onupgradeneeded = () => {
    const database = request.result;
    for (const store of schema.stores) {
      const existing = database.objectStoreNames.contains(store.name)
        ? request.transaction?.objectStore(store.name)
        : database.createObjectStore(store.name, { keyPath: store.keyPath });
      if (!existing) {
        continue;
      }
      for (const index of store.indexes ?? []) {
        if (!existing.indexNames.contains(index.name)) {
          existing.createIndex(index.name, index.keyPath, { unique: false });
        }
      }
    }
  };
  return requestToPromise(request);
}

export function createIndexedDbPort(database: IDBDatabase): OfflineKvPort {
  return {
    async get(storeName, key) {
      const transaction = database.transaction(storeName, "readonly");
      const value = await requestToPromise(transaction.objectStore(storeName).get(key));
      await transactionDone(transaction);
      return value ?? null;
    },
    async put(storeName, record) {
      try {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(record);
        await transactionDone(transaction);
      } catch (error: unknown) {
        if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "QuotaExceededError") {
          throw new OfflineQuotaExceededError();
        }
        throw error;
      }
    },
    async delete(storeName, key) {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(key);
      await transactionDone(transaction);
    },
    async getAll(storeName) {
      const transaction = database.transaction(storeName, "readonly");
      const values = await requestToPromise(transaction.objectStore(storeName).getAll());
      await transactionDone(transaction);
      return values;
    },
    async getAllByIndex(storeName, indexName, value) {
      const transaction = database.transaction(storeName, "readonly");
      const values = await requestToPromise(transaction.objectStore(storeName).index(indexName).getAll(value));
      await transactionDone(transaction);
      return values;
    },
  };
}
