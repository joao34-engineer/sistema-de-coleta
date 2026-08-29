import "server-only";

import { createHash } from "node:crypto";

type TransactionFailure = Readonly<{
  requestId: string;
  operation: string;
  code: string;
  actorId: string | null;
  status: number;
}>;

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const actorIdProperty = "actorId";

export function getRequestId(request?: Request): string {
  const candidate = request?.headers.get("x-request-id")?.trim();
  return candidate && requestIdPattern.test(candidate) ? candidate : crypto.randomUUID();
}

function pseudonymizeActor(actorId: string | null): string | null {
  if (!actorId) return null;
  return createHash("sha256").update(actorId).digest("hex").slice(0, 16);
}

export function attachActorId<T>(error: T, actorId: string): T {
  if (typeof error === "object" && error !== null) {
    Object.defineProperty(error, actorIdProperty, { value: actorId, enumerable: false, configurable: true });
  }
  return error;
}

export function actorIdFromUnknown(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !(actorIdProperty in error)) return null;
  const actorId = (error as { actorId?: unknown }).actorId;
  return typeof actorId === "string" && actorId.length > 0 ? actorId : null;
}

export function logTransactionFailure(event: TransactionFailure): void {
  // Deliberately build an allow-listed payload. Never pass the original error or request body here.
  const safeEvent = {
    event: "transaction_failure",
    requestId: event.requestId,
    operation: event.operation,
    code: event.code,
    status: event.status,
    actor: pseudonymizeActor(event.actorId),
  } as const;
  try {
    console.error(JSON.stringify(safeEvent));
  } catch {
    // Logging is best-effort and must never change the API result.
  }
}
