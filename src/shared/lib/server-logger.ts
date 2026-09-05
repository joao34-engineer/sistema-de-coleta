import "server-only";

import { createHash } from "node:crypto";
import { sendErrorAlert } from "@/shared/lib/error-alert.server";

type TransactionFailure = Readonly<{
  requestId: string;
  operation: string;
  code: string;
  actorId: string | null;
  status: number;
  databaseCode?: string;
}>;

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const sqlStatePattern = /^[0-9A-Z]{5}$/;
const actorIdProperty = "actorId";

export function sanitizeDatabaseCode(code: string | undefined): string | undefined {
  if (code === undefined || !sqlStatePattern.test(code)) return undefined;
  return code;
}

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
  const databaseCode = sanitizeDatabaseCode(event.databaseCode);
  const safeEvent = {
    event: "transaction_failure" as const,
    requestId: event.requestId,
    operation: event.operation,
    code: event.code,
    status: event.status,
    actor: pseudonymizeActor(event.actorId),
    ...(databaseCode === undefined ? {} : { databaseCode }),
  };
  try {
    console.error(JSON.stringify(safeEvent));
  } catch {
    // Logging is best-effort and must never change the API result.
  }
  if (event.status >= 500) {
    void sendErrorAlert(safeEvent);
  }
}
