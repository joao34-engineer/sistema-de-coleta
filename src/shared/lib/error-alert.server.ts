import "server-only";

export type ErrorAlertPayload = Readonly<{
  event: "transaction_failure";
  requestId: string;
  operation: string;
  code: string;
  status: number;
  actor: string | null;
}>;

const WEBHOOK_TIMEOUT_MS = 2_000;
const MAX_DEDUPE_ENTRIES = 256;

const recentRequestIds = new Set<string>();
const recentRequestIdOrder: string[] = [];

function rememberRequestId(requestId: string): boolean {
  if (recentRequestIds.has(requestId)) return false;
  recentRequestIds.add(requestId);
  recentRequestIdOrder.push(requestId);
  while (recentRequestIdOrder.length > MAX_DEDUPE_ENTRIES) {
    const oldest = recentRequestIdOrder.shift();
    if (oldest) recentRequestIds.delete(oldest);
  }
  return true;
}

function resolveWebhookUrl(): string | null {
  const raw = process.env["ERROR_ALERT_WEBHOOK_URL"];
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Best-effort alert for unexpected failures. Fail-open: never throws, never
 * logs the webhook URL, and never blocks the caller beyond a short fetch.
 */
export async function sendErrorAlert(payload: ErrorAlertPayload): Promise<void> {
  if (payload.status < 500) return;
  const webhookUrl = resolveWebhookUrl();
  if (!webhookUrl) return;
  if (!rememberRequestId(payload.requestId)) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch {
    // Fail-open: alerting must never change the API or page result.
  }
}

/** Test helper — clears in-process dedupe state. */
export function resetErrorAlertDedupeForTests(): void {
  recentRequestIds.clear();
  recentRequestIdOrder.length = 0;
}
