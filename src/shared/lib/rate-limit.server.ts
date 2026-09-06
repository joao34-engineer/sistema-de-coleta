import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertServiceProjectRef, getServiceEnvironment } from "@/shared/config/environment";

const rateLimitResultRowSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
}).strict();

const rateLimitResultSchema = z.tuple([rateLimitResultRowSchema]);

type RateLimitDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      consume_document_rate_limit: {
        Args: Readonly<{
          p_scope: string;
          p_subject_hash: string;
          p_window_seconds: number;
          p_limit: number;
        }>;
        Returns: unknown;
      };
      peek_document_rate_limit: {
        Args: Readonly<{
          p_scope: string;
          p_subject_hash: string;
          p_window_seconds: number;
          p_limit: number;
        }>;
        Returns: unknown;
      };
      reset_document_rate_limit: {
        Args: Readonly<{
          p_scope: string;
          p_subject_hash: string;
          p_window_seconds: number;
        }>;
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type DocumentRateLimitScope =
  | "public_verification"
  | "document_share_create"
  | "document_email_administrator"
  | "document_email_organization"
  | "document_share_download"
  | "auth_login";

export type DocumentRateLimitRule = Readonly<{
  scope: DocumentRateLimitScope;
  limit: number;
  windowSeconds: number;
}>;

export const documentRateLimitRules = {
  verification: { scope: "public_verification", limit: 30, windowSeconds: 5 * 60 },
  shareCreate: { scope: "document_share_create", limit: 30, windowSeconds: 60 * 60 },
  emailAdministrator: { scope: "document_email_administrator", limit: 10, windowSeconds: 60 * 60 },
  emailOrganization: { scope: "document_email_organization", limit: 50, windowSeconds: 24 * 60 * 60 },
  shareDownload: { scope: "document_share_download", limit: 30, windowSeconds: 5 * 60 },
  login: { scope: "auth_login", limit: 5, windowSeconds: 15 * 60 },
} as const satisfies Record<string, DocumentRateLimitRule>;

export class DocumentRateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("document_rate_limit_exceeded");
    this.name = "DocumentRateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DocumentRateLimitUnavailableError extends Error {
  constructor() {
    super("document_rate_limit_unavailable");
    this.name = "DocumentRateLimitUnavailableError";
  }
}

export class DocumentRateLimitSecretMissingError extends DocumentRateLimitUnavailableError {
  constructor() {
    super();
    this.name = "DocumentRateLimitSecretMissingError";
  }
}

export function getDocumentRateLimitSecret(): string {
  const secret = process.env["DOCUMENT_RATE_LIMIT_SECRET"];
  if (typeof secret !== "string" || secret.length < 32) throw new DocumentRateLimitSecretMissingError();
  return secret;
}

export function hashDocumentRateLimitSubject(subject: string, secret: string): string {
  if (subject.length === 0) throw new TypeError("document_rate_limit_subject_invalid");
  if (secret.length < 32) throw new DocumentRateLimitUnavailableError();
  return createHmac("sha256", secret).update(subject, "utf8").digest("hex");
}

/**
 * Trust only the first address supplied by the deployment proxy. If that
 * header is absent or malformed, all such requests share an opaque bucket;
 * this fails closed without storing a raw IP address.
 */
export function requestIpRateLimitSubject(request: Pick<Request, "headers">): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim() ?? "";
  if (isIP(firstForwarded) !== 0) return `ip:${firstForwarded}`;

  const remoteAddress = request.headers.get("x-real-ip")?.trim() ?? "";
  if (isIP(remoteAddress) !== 0) return `ip:${remoteAddress}`;

  return "ip:unavailable";
}

function createRateLimitClient() {
  const environment = getServiceEnvironment();
  assertServiceProjectRef(environment);
  return createClient<RateLimitDatabase>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function loginRateLimitSubject(request: Pick<Request, "headers">, email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) throw new TypeError("document_rate_limit_subject_invalid");
  return `${requestIpRateLimitSubject(request)}:${normalizedEmail}`;
}

export async function enforceDocumentRateLimit(rule: DocumentRateLimitRule, subject: string): Promise<void> {
  const subjectHash = hashDocumentRateLimitSubject(subject, getDocumentRateLimitSecret());
  const { data, error } = await createRateLimitClient().rpc("consume_document_rate_limit", {
    p_scope: rule.scope,
    p_subject_hash: subjectHash,
    p_window_seconds: rule.windowSeconds,
    p_limit: rule.limit,
  });

  if (error) throw new DocumentRateLimitUnavailableError();
  const parsed = rateLimitResultSchema.safeParse(data);
  if (!parsed.success) throw new DocumentRateLimitUnavailableError();
  const result = parsed.data[0];
  if (!result.allowed) throw new DocumentRateLimitExceededError(result.retry_after_seconds);
}

export async function enforcePublicVerificationRateLimit(request: Pick<Request, "headers">): Promise<void> {
  await enforceDocumentRateLimit(documentRateLimitRules.verification, requestIpRateLimitSubject(request));
}

export async function enforceShareDownloadRateLimit(request: Pick<Request, "headers">): Promise<void> {
  await enforceDocumentRateLimit(documentRateLimitRules.shareDownload, requestIpRateLimitSubject(request));
}

export async function enforceLoginRateLimit(request: Pick<Request, "headers">, email: string): Promise<void> {
  await enforceDocumentRateLimit(documentRateLimitRules.login, loginRateLimitSubject(request, email));
}

export async function peekDocumentRateLimit(rule: DocumentRateLimitRule, subject: string): Promise<void> {
  const subjectHash = hashDocumentRateLimitSubject(subject, getDocumentRateLimitSecret());
  const { data, error } = await createRateLimitClient().rpc("peek_document_rate_limit", {
    p_scope: rule.scope,
    p_subject_hash: subjectHash,
    p_window_seconds: rule.windowSeconds,
    p_limit: rule.limit,
  });

  if (error) throw new DocumentRateLimitUnavailableError();
  const parsed = rateLimitResultSchema.safeParse(data);
  if (!parsed.success) throw new DocumentRateLimitUnavailableError();
  const result = parsed.data[0];
  if (!result.allowed) throw new DocumentRateLimitExceededError(result.retry_after_seconds);
}

export async function resetDocumentRateLimit(
  rule: Pick<DocumentRateLimitRule, "scope" | "windowSeconds">,
  subject: string,
): Promise<void> {
  const subjectHash = hashDocumentRateLimitSubject(subject, getDocumentRateLimitSecret());
  const { error } = await createRateLimitClient().rpc("reset_document_rate_limit", {
    p_scope: rule.scope,
    p_subject_hash: subjectHash,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) throw new DocumentRateLimitUnavailableError();
}

export async function resetLoginRateLimit(request: Pick<Request, "headers">, email: string): Promise<void> {
  await resetDocumentRateLimit(documentRateLimitRules.login, loginRateLimitSubject(request, email));
}
