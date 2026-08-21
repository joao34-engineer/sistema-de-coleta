import "server-only";

import { getPublicEnvironment } from "@/shared/config/environment";
import { createDocumentArtifactRepository, createDocumentJobQueue } from "./job-queue.server";
import { processNextDocumentJob } from "./generation-saga.server";
import { createDocumentArtifactStorage } from "./storage.server";

export async function runDocumentWorkerOnce() {
  const environment = getPublicEnvironment();
  if (!environment.appUrl) throw new Error("document_verification_base_url_missing");
  return processNextDocumentJob({
    jobs: createDocumentJobQueue(),
    artifacts: createDocumentArtifactRepository(),
    storage: createDocumentArtifactStorage(),
    verificationBaseUrl: environment.appUrl,
  });
}
