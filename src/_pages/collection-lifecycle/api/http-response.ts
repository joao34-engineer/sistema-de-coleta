import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import type { LifecycleApiError } from "./lifecycle-errors";

const idempotencyKeySchema = z.uuid();

export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, { ...init, headers: { ...init?.headers, "Cache-Control": "no-store" } });
}

export function apiErrorResponse(error: LifecycleApiError): NextResponse {
  return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export function validationErrorResponse(): NextResponse {
  return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
}

export function idempotencyKeyFrom(request: Request): string | null {
  const parsed = idempotencyKeySchema.safeParse(request.headers.get("Idempotency-Key"));
  return parsed.success ? parsed.data : null;
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
