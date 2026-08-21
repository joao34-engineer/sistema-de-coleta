import "server-only";

import { renderCollectionDocument } from "./index";
import { type ArtifactDraft, type DocumentJob, type DocumentSource } from "./generation-contracts";
import { documentRenderInputSchema, type FrozenDocumentAssets } from "./contracts";
import type { DocumentArtifactRepository, DocumentJobQueue } from "./job-queue.server";
import type { DocumentArtifactStorage } from "./storage.server";
import { sha256Hex } from "./canonical-json";
import { createQrPayload } from "./qr-payload";
import { renderVerificationQrPng } from "./qr-png.server";

export type DocumentGenerationDependencies = Readonly<{
  jobs: DocumentJobQueue;
  artifacts: DocumentArtifactRepository;
  storage: DocumentArtifactStorage;
  verificationBaseUrl: string;
  now?: () => Date;
}>;

export type DocumentGenerationResult = Readonly<
  | { status: "idle" }
  | { status: "succeeded"; jobId: string; artifactId: string; storagePath: string; sha256: string }
  | { status: "retry_scheduled"; jobId: string; errorCode: string }
  | { status: "failed"; jobId: string; errorCode: string }
>;

class DocumentGenerationFailure extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function errorDetails(error: unknown): Readonly<{ code: string; message: string }> {
  if (error instanceof DocumentGenerationFailure) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: "render_failed", message: error.message };
  return { code: "render_failed", message: "Falha inesperada na renderização." };
}

export async function renderDocumentJobArtifact(
  job: DocumentJob,
  source: DocumentSource,
  verificationBaseUrl: string,
  frozenAssets?: FrozenDocumentAssets,
): Promise<Readonly<{ bytes: Uint8Array; sha256: string; artifactType: "pdf" | "qr" }>> {
  if (job.document_id !== source.id) throw new DocumentGenerationFailure("document_source_mismatch", "O documento do job não corresponde ao snapshot carregado.");
  const input = documentRenderInputSchema.parse({ snapshot: source.snapshot, documentVersion: source.version, verificationToken: source.verification_token, verificationBaseUrl, issuedAt: source.issued_at, frozenAssets });
  if (job.job_type === "render_qr") {
    const bytes = await renderVerificationQrPng(createQrPayload(input));
    return { bytes, sha256: sha256Hex(bytes), artifactType: "qr" };
  }
  const rendered = await renderCollectionDocument(input);
  return { bytes: rendered.pdfBytes, sha256: rendered.pdfSha256, artifactType: "pdf" };
}

export async function processNextDocumentJob(dependencies: DocumentGenerationDependencies): Promise<DocumentGenerationResult> {
  const lease = await dependencies.jobs.claimNext();
  if (!lease) return { status: "idle" };
  const job = lease.job;
  let draft: ArtifactDraft | null = null;
  let committedArtifactId: string | null = null;
  try {
    const source = await dependencies.jobs.getDocument(job.document_id);
    const frozenAssets = job.job_type === "render_pdf" ? await dependencies.jobs.getFrozenAssets(source) : undefined;
    const rendered = await renderDocumentJobArtifact(job, source, dependencies.verificationBaseUrl, frozenAssets);
    draft = await dependencies.artifacts.prepare(job, rendered.artifactType, rendered.bytes.byteLength, rendered.sha256);
    if (draft.artifactId !== null) {
      await dependencies.jobs.succeed(job, draft.artifactId);
      return { status: "succeeded", jobId: job.id, artifactId: draft.artifactId, storagePath: draft.storagePath, sha256: draft.sha256 };
    }
    await dependencies.storage.upload(draft, rendered.bytes);
    const committed = await dependencies.artifacts.commit(draft);
    committedArtifactId = committed.artifactId;
    await dependencies.jobs.succeed(job, committed.artifactId);
    return { status: "succeeded", jobId: job.id, artifactId: committed.artifactId, storagePath: draft.storagePath, sha256: rendered.sha256 };
  } catch (error) {
    const details = errorDetails(error);
    if (draft !== null && draft.intentId !== null && committedArtifactId === null) {
      try {
        const canceled = await dependencies.artifacts.cancel(draft);
        if (canceled?.status === "canceled") await dependencies.storage.remove(draft);
      } catch {
        // The intent remains traceable for the server-side cleanup process.
      }
    }
    try {
      const completion = await dependencies.jobs.fail(job, details.code, details.message);
      return completion.status === "failed"
        ? { status: "failed", jobId: job.id, errorCode: details.code }
        : { status: "retry_scheduled", jobId: job.id, errorCode: details.code };
    } catch {
      return { status: "failed", jobId: job.id, errorCode: "job_state_update_failed" };
    }
  }
}

export function contentHash(bytes: Uint8Array): string {
  return sha256Hex(bytes);
}
