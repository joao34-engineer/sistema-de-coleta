export const BACKUP_BUCKETS = [
  "organization-assets",
  "collection-evidences",
  "collection-signatures",
  "collection-documents",
] as const;

export type BackupBucketId = (typeof BACKUP_BUCKETS)[number];

export const BACKUP_METADATA_TABLES = [
  "document_artifacts",
  "signatures",
  "evidences",
  "organization_brand_assets",
] as const;

export type BackupMetadataTable = (typeof BACKUP_METADATA_TABLES)[number];

export function isBackupBucketId(value: string): value is BackupBucketId {
  return (BACKUP_BUCKETS as readonly string[]).includes(value);
}
