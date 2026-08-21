import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api/database.types";
import { getServiceEnvironment } from "@/shared/config/environment";
import { cleanupExpiredCollectionUploads, type UploadCleanupClient } from "@/_pages/collection-lifecycle/api/upload-cleanup.server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";

// The delegated operation calls expire_collection_upload_intents, removes each
// object through storage.from(bucket).remove(paths), then acknowledges it with
// ack_collection_upload_cleanup. Keeping this contract explicit makes the
// scheduled entry point auditable without exposing any object or actor data.

function projectRefFromUrl(value: string): string {
  const hostname = new URL(value).hostname;
  const [ref] = hostname.split(".");
  if (!ref) throw new Error("Não foi possível identificar o projeto Supabase.");
  return ref;
}

async function main(): Promise<void> {
  const environment = getServiceEnvironment();
  const projectRef = projectRefFromUrl(environment.supabaseUrl);
  if (projectRef !== environment.confirmProjectRef) throw new Error("SUPABASE_CONFIRM_PROJECT_REF não coincide com o projeto alvo.");
  const client = createClient<Database>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as UploadCleanupClient;
  const summary = await cleanupExpiredCollectionUploads(client);
  console.log(JSON.stringify({ event: "collection_upload_cleanup", projectRef, ...summary }));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch(() => {
  logTransactionFailure({ requestId: getRequestId(), operation: "collection_upload_cleanup", code: "cleanup_unexpected_error", actorId: null, status: 500 });
  process.exitCode = 1;
});
