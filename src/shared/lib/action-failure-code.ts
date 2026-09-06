/** Stable machine codes for offline queue / classify — never Portuguese. */

const MACHINE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

const KNOWN_ACTION_FAILURE_CODES: ReadonlySet<string> = new Set([
  "authentication_required",
  "administrator_access_denied",
  "stale_version",
  "idempotency_conflict",
  "invalid_signature_file",
  "collection_incomplete",
  "issuer_profile_incomplete",
  "validation_error",
  "workshop_checkin_not_collected",
  "budget_not_in_workshop",
  "budget_not_in_budget",
  "service_order_not_in_service",
  "invoice_not_ready",
  "delivery_not_invoiced",
  "collection_cannot_be_canceled",
  "collection_not_canceled",
  "collection_not_draft",
  "immutable_record",
  "invalid_discard_request",
  "not_found",
  "signature_contract_invalid",
  "signature_upload_failed",
  "operation_failed",
  "finalize_failed",
]);

type CodedFailure = Readonly<{ code?: unknown; message?: unknown }>;

function asCoded(error: unknown): CodedFailure | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  return error as CodedFailure;
}

function isMachineCode(value: string): boolean {
  return MACHINE_CODE_PATTERN.test(value);
}

/**
 * Maps thrown/DAL failures to a stable snake_case code for the offline runner.
 * Does not translate — UI must use `messageForQueueError` / `toSafeActionError` for display.
 */
export function toActionFailureCode(error: unknown): string {
  if (error instanceof Error) {
    if (KNOWN_ACTION_FAILURE_CODES.has(error.message) || isMachineCode(error.message)) {
      return error.message;
    }
    const supabaseCode = asCoded(error)?.code;
    if (supabaseCode === "40001") {
      return "stale_version";
    }
    if (supabaseCode === "42501") {
      return "forbidden";
    }
    if (supabaseCode === "P0001" && isMachineCode(error.message)) {
      return error.message;
    }
  }

  const coded = asCoded(error);
  if (coded) {
    const code = typeof coded.code === "string" ? coded.code : null;
    const message = typeof coded.message === "string" ? coded.message : null;
    if (code === "40001") {
      return "stale_version";
    }
    if (code === "42501") {
      return "forbidden";
    }
    if (code === "P0001" && message !== null && isMachineCode(message)) {
      return message;
    }
    if (code !== null && (KNOWN_ACTION_FAILURE_CODES.has(code) || isMachineCode(code))) {
      if (code !== "P0001" && code !== "40001" && !/^\d+$/.test(code)) {
        return code;
      }
    }
  }

  return "operation_failed";
}

/** Finalize-only remap: unknown failures become `finalize_failed`, not generic `operation_failed`. */
export function toFinalizeActionFailureCode(error: unknown): string {
  const code = toActionFailureCode(error);
  if (code === "operation_failed") {
    return "finalize_failed";
  }
  return code;
}
