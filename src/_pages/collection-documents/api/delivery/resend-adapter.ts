import "server-only";

import { z } from "zod";

export type ResendEmail = Readonly<{
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}>;

export type ResendSendResult = Readonly<{
  result: "queued";
  providerReference: string;
}>;

/**
 * Phase 2 keeps provider delivery behind this boundary. Until the provider
 * is explicitly enabled, this adapter records a deterministic dry-run only.
 */
export type ResendAdapter = Readonly<{ send(message: ResendEmail): Promise<ResendSendResult> }>;

const resendEnvironmentSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  DOCUMENT_FROM_EMAIL: z.email(),
});

function validateProviderEnvironment(): void {
  if (process.env["NODE_ENV"] === "test" || process.env["DOCUMENT_EMAIL_SEND_ENABLED"] !== "true") return;
  const parsed = resendEnvironmentSchema.safeParse({ RESEND_API_KEY: process.env["RESEND_API_KEY"], DOCUMENT_FROM_EMAIL: process.env["DOCUMENT_FROM_EMAIL"] });
  if (!parsed.success) throw new Error("document_email_provider_not_configured");
}

export function createResendAdapter(): ResendAdapter {
  validateProviderEnvironment();
  return {
    async send(message) {
      if (process.env["NODE_ENV"] !== "test" && process.env["DOCUMENT_EMAIL_SEND_ENABLED"] === "true") {
        const parsed = resendEnvironmentSchema.parse({ RESEND_API_KEY: process.env["RESEND_API_KEY"], DOCUMENT_FROM_EMAIL: process.env["DOCUMENT_FROM_EMAIL"] });
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${parsed.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
          body: JSON.stringify({ from: parsed.DOCUMENT_FROM_EMAIL, to: [message.to], subject: message.subject, text: message.text }),
        });
        if (!response.ok) throw new Error("document_email_provider_failed");
        const body: unknown = await response.json();
        const providerId = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : null;
        if (!providerId) throw new Error("document_email_provider_response_invalid");
        return { result: "queued", providerReference: `resend:${providerId}:${message.idempotencyKey}` };
      }
      return { result: "queued", providerReference: `dry-run:${message.idempotencyKey}` };
    },
  };
}
