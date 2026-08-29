import { z } from "zod";
import { BACKUP_BUCKETS } from "./inventory";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const backupObjectSchema = z
  .object({
    bucket: z.enum(BACKUP_BUCKETS),
    path: z.string().min(1).max(1024),
    byteSize: z.number().int().nonnegative(),
    sha256: sha256Schema,
  })
  .strict();

export const backupManifestSchema = z
  .object({
    version: z.literal(1),
    createdAt: z.string().min(1),
    sourceProjectRef: z.string().min(1).max(64),
    objectCounts: z.record(z.string(), z.number().int().nonnegative()),
    objects: z.array(backupObjectSchema),
  })
  .strict();

export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type BackupManifestObject = z.infer<typeof backupObjectSchema>;

export function parseBackupManifest(value: unknown): BackupManifest {
  return backupManifestSchema.parse(value);
}
