import "server-only";

import { classifyCommandError } from "@/shared/lib/command-error";
import { actorIdFromUnknown } from "@/shared/lib/server-logger";

export type LifecycleApiError = Readonly<{ status: number; code: string; message: string; actorId: string | null }>;

export function toLifecycleApiError(error: unknown): LifecycleApiError {
  const mapped = classifyCommandError(error);
  return { status: mapped.status, code: mapped.code, message: mapped.httpMessage, actorId: actorIdFromUnknown(error) };
}
