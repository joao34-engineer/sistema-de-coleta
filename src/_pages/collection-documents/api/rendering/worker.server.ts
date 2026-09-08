import "server-only";

import { getPublicEnvironment } from "@/shared/config/environment";
import { createDocumentArtifactRepository, createDocumentJobQueue } from "./job-queue.server";
import { processNextDocumentJob } from "./generation-saga.server";
import { createDocumentArtifactStorage } from "./storage.server";

export async function runDocumentWorkerOnce(documentId?: string) {
  const environment = getPublicEnvironment();
  if (!environment.appUrl) throw new Error("document_verification_base_url_missing");
  return processNextDocumentJob({
    jobs: createDocumentJobQueue(undefined, undefined, documentId),
    artifacts: createDocumentArtifactRepository(),
    storage: createDocumentArtifactStorage(),
    verificationBaseUrl: environment.appUrl,
  });
}
