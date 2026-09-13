import { classifyCommandError } from "@/shared/lib/command-error";

export type SafeActionFailure = Readonly<{ ok: false; error: string }>;

export function toSafeActionError(error: unknown): SafeActionFailure {
  return { ok: false, error: classifyCommandError(error).actionMessage };
}
