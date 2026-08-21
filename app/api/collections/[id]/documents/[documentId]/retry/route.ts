import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST() {
  return noStoreJson({ error: { code: "document_retry_not_available", message: "A geração é retomada pelo worker com lease idempotente." } }, { status: 422 });
}

