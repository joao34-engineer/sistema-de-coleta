import "server-only";

import { classifyCommandError } from "@/shared/lib/command-error";
import { actorIdFromUnknown } from "@/shared/lib/server-logger";

export type OperationsApiError = Readonly<{ status: number; code: string; message: string; actorId: string | null }>;

export function toOperationsApiError(error: unknown): OperationsApiError {
  const mapped = classifyCommandError(error);
  return { status: mapped.status, code: mapped.code, message: mapped.httpMessage, actorId: actorIdFromUnknown(error) };
}
