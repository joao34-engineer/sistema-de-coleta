import { createClient } from "@supabase/supabase-js";
import { BACKUP_BUCKETS, type BackupBucketId } from "./inventory";

type ListedItem = Readonly<{ name: string; id: string | null; metadata: Record<string, unknown> | null }>;

export type StorageListClient = Readonly<{
  storage: {
    from: (bucket: BackupBucketId) => {
      list: (
        path?: string,
        options?: { limit?: number; offset?: number },
      ) => Promise<{ data: ListedItem[] | null; error: { message: string } | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      upload: (
        path: string,
        body: Buffer,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
}>;

export function createServiceStorageClient(url: string, secretKey: string): StorageListClient {
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as StorageListClient;
}

export async function listBucketObjectPaths(
  client: StorageListClient,
  bucket: BackupBucketId,
): Promise<readonly string[]> {
  const paths: string[] = [];

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    const limit = 100;
    for (;;) {
      const { data, error } = await client.storage.from(bucket).list(prefix || undefined, { limit, offset });
      if (error) throw new Error(`Falha ao listar ${bucket}/${prefix}: ${error.message}`);
      const items = data ?? [];
      if (items.length === 0) break;
      for (const item of items) {
        if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
        const childPath = prefix ? `${prefix}/${item.name}` : item.name;
        const isFile = item.id !== null || (item.metadata !== null && item.metadata !== undefined);
        if (isFile && item.id !== null) {
          paths.push(childPath);
        } else {
          await walk(childPath);
        }
      }
      if (items.length < limit) break;
      offset += limit;
    }
  }

  await walk("");
  return paths;
}

export function emptyObjectCounts(): Record<BackupBucketId, number> {
  const counts = {} as Record<BackupBucketId, number>;
  for (const bucket of BACKUP_BUCKETS) counts[bucket] = 0;
  return counts;
}
