import "server-only";

export { listCollectionDocuments, createDocumentArtifactDownload, consumeDocumentShare, createConsumedShareDownload } from "./queries.server";
export { createDocumentShare, revokeDocumentShare, reviseCollectionDocument, createDocumentRevision } from "./shares.server";
export { queueDocumentShareEmail } from "./email.server";
export { isWorkerRequestAuthorized, runDocumentWorkerBatch } from "./worker.server";
export { deliveryErrorResponse, DocumentDeliveryError } from "./errors";
export { emailShareSchema, revisionSchema, shareCreateSchema } from "./contracts";
export { enforcePublicVerificationRateLimit, DocumentRateLimitExceededError, DocumentRateLimitUnavailableError } from "./rate-limit.server";
export type { DocumentListDTO, ConsumedShare } from "./contracts";
