export const DOCUMENT_JOB_MAX_ATTEMPTS = 20;
export const DOCUMENT_JOB_LEASE_MS = 5 * 60 * 1000;

export type RetryDecision = Readonly<{
  terminal: boolean;
  status: "queued" | "failed";
  availableAt: string | null;
}>;

export function documentRetryDelayMs(attemptCount: number): number {
  const boundedAttempt = Math.max(1, Math.min(attemptCount, 20));
  return Math.min(60 * 60 * 1000, 5_000 * (2 ** (boundedAttempt - 1)));
}

export function decideDocumentRetry(attemptCount: number, now = new Date()): RetryDecision {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new RangeError("A tentativa deve ser um inteiro positivo.");
  if (attemptCount >= DOCUMENT_JOB_MAX_ATTEMPTS) return { terminal: true, status: "failed", availableAt: null };
  return {
    terminal: false,
    status: "queued",
    availableAt: new Date(now.getTime() + documentRetryDelayMs(attemptCount)).toISOString(),
  };
}

export function isLeaseExpired(startedAt: string | null, now = new Date(), leaseMs = DOCUMENT_JOB_LEASE_MS): boolean {
  if (!startedAt) return false;
  const timestamp = Date.parse(startedAt);
  return Number.isFinite(timestamp) && timestamp + leaseMs <= now.getTime();
}
