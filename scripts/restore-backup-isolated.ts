import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRestoreEnvironment, loadEnvLocal } from "./backup/env";
import { parseBackupManifest } from "./backup/manifest";
import { assertRestoreTargetIsIsolated } from "./backup/project-guard";
import { createServiceStorageClient } from "./backup/storage";
import { storageObjectRelativePath, verifyBackupBundle } from "./backup/verify-bundle";

function applyDumpWithPsql(databaseUrl: string, dumpPath: string): void {
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", dumpPath], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error("psql falhou ao aplicar dump.sql. Confirme RESTORE_DATABASE_URL e o PATH do psql.");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const environment = getRestoreEnvironment();
  assertRestoreTargetIsIsolated({
    sourceProjectRef: environment.sourceProjectRef,
    targetProjectRef: environment.restoreConfirmProjectRef,
    targetUrl: environment.restoreUrl,
  });

  const manifestRaw = JSON.parse(
    await readFile(path.join(environment.inputDir, "manifest.json"), "utf8"),
  ) as unknown;
  const manifest = parseBackupManifest(manifestRaw);
  const verified = await verifyBackupBundle(environment.inputDir, manifest);
  if (!verified.ok) {
    throw new Error(`Bundle inválido (${verified.failures.length} falha(s)). Rode backup:verify.`);
  }

  const dumpPath = path.join(environment.inputDir, "dump.sql");
  applyDumpWithPsql(environment.restoreDatabaseUrl, dumpPath);

  const client = createServiceStorageClient(environment.restoreUrl, environment.restoreSecretKey);
  let uploaded = 0;
  for (const object of manifest.objects) {
    const absolute = path.join(environment.inputDir, storageObjectRelativePath(object));
    const bytes = await readFile(absolute);
    const upload = await client.storage.from(object.bucket).upload(object.path, bytes, {
      upsert: true,
    });
    if (upload.error) {
      throw new Error(`Falha no upload ${object.bucket}/${object.path}.`);
    }
    uploaded += 1;
  }

  console.log(
    JSON.stringify({
      event: "backup_restore_isolated",
      sourceProjectRef: environment.sourceProjectRef,
      targetProjectRef: environment.restoreConfirmProjectRef,
      uploaded,
      objectCounts: manifest.objectCounts,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "backup_restore_failed";
  console.error(JSON.stringify({ event: "backup_restore_error", message }));
  process.exitCode = 1;
});
