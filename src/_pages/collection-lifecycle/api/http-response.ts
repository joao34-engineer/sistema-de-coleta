import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { logTransactionFailure } from "@/shared/lib/server-logger";

const idempotencyKeySchema = z.uuid();

export type IdempotencyKeyState = Readonly<
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; value: string }
>;

export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, { ...init, headers: { ...init?.headers, "Cache-Control": "no-store" } });
}

export function apiErrorResponse(
  error: Readonly<{ status: number; code: string; message: string; actorId?: string | null }>,
  requestId?: string,
  operation = "lifecycle_command",
): NextResponse {
  if (requestId && error.status >= 500) {
    logTransactionFailure({ requestId, operation, code: error.code, actorId: error.actorId ?? null, status: error.status });
  }
  return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export function validationErrorResponse(): NextResponse {
  return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
}

export function idempotencyKeyRequiredResponse(): NextResponse {
  return noStoreJson({ error: { code: "idempotency_key_required", message: "Informe o cabeçalho Idempotency-Key." } }, { status: 400 });
}

export function idempotencyKeyState(request: Request): IdempotencyKeyState {
  const raw = request.headers.get("Idempotency-Key");
  if (raw === null || raw.trim() === "") return { kind: "missing" };
  const parsed = idempotencyKeySchema.safeParse(raw);
  return parsed.success ? { kind: "valid", value: parsed.data } : { kind: "invalid" };
}

export function idempotencyKeyFrom(request: Request): string | null {
  const state = idempotencyKeyState(request);
  return state.kind === "valid" ? state.value : null;
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
