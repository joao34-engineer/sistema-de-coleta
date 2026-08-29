import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BACKUP_BUCKETS } from "./backup/inventory";
import { getExportEnvironment, loadEnvLocal } from "./backup/env";
import type { BackupManifest, BackupManifestObject } from "./backup/manifest";
import { assertOutputDirOutsideRepo } from "./backup/paths";
import { createServiceStorageClient, emptyObjectCounts, listBucketObjectPaths } from "./backup/storage";
import { sha256Hex, storageObjectRelativePath } from "./backup/verify-bundle";

async function dumpDatabase(outputFile: string): Promise<void> {
  const result = spawnSync(
    "npx",
    ["supabase", "db", "dump", "--linked", "-f", outputFile],
    { cwd: process.cwd(), encoding: "utf8", shell: true },
  );
  if (result.status !== 0) {
    throw new Error("supabase db dump --linked falhou. Confirme o link do MVP e a CLI.");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const environment = getExportEnvironment();
  assertOutputDirOutsideRepo(environment.outputDir);

  await mkdir(environment.outputDir, { recursive: true });
  const dumpPath = path.join(environment.outputDir, "dump.sql");
  await dumpDatabase(dumpPath);

  const client = createServiceStorageClient(environment.supabaseUrl, environment.supabaseSecretKey);
  const objects: BackupManifestObject[] = [];
  const objectCounts = emptyObjectCounts();

  for (const bucket of BACKUP_BUCKETS) {
    const paths = await listBucketObjectPaths(client, bucket);
    objectCounts[bucket] = paths.length;
    for (const objectPath of paths) {
      const downloaded = await client.storage.from(bucket).download(objectPath);
      if (downloaded.error || !downloaded.data) {
        throw new Error(`Falha ao baixar ${bucket}/${objectPath}.`);
      }
      const buffer = Buffer.from(await downloaded.data.arrayBuffer());
      const relative = storageObjectRelativePath({
        bucket,
        path: objectPath,
        byteSize: buffer.byteLength,
        sha256: sha256Hex(buffer),
      });
      const absolute = path.join(environment.outputDir, relative);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, buffer);
      objects.push({
        bucket,
        path: objectPath,
        byteSize: buffer.byteLength,
        sha256: sha256Hex(buffer),
      });
    }
  }

  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceProjectRef: environment.sourceProjectRef,
    objectCounts,
    objects,
  };
  await writeFile(path.join(environment.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      event: "backup_export",
      sourceProjectRef: environment.sourceProjectRef,
      objectCounts,
      objectTotal: objects.length,
      dump: "dump.sql",
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "backup_export_failed";
  console.error(JSON.stringify({ event: "backup_export_error", message }));
  process.exitCode = 1;
});
