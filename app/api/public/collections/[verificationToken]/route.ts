import { z } from "zod";
import { verifyCollectionDocument } from "@/_pages/collection-documents/index.server";
import { DocumentRateLimitExceededError, DocumentRateLimitUnavailableError, enforcePublicVerificationRateLimit } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
const publicHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, noarchive",
} as const;

function publicVerificationJson(body: unknown, init?: ResponseInit) {
  return noStoreJson(body, { ...init, headers: { ...init?.headers, ...publicHeaders } });
}

export async function GET(request: Request, context: RouteContext<"/api/public/collections/[verificationToken]">) {
  const { verificationToken } = await context.params;
  const parsed = tokenSchema.safeParse(verificationToken);
  if (!parsed.success) return publicVerificationJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  try {
    await enforcePublicVerificationRateLimit(request);
    const verification = await verifyCollectionDocument(parsed.data);
    return verification ? publicVerificationJson(verification) : publicVerificationJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return publicVerificationJson({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de consultar novamente." } }, {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, error.retryAfterSeconds)) },
      });
    }
    if (error instanceof DocumentRateLimitUnavailableError) {
      return publicVerificationJson({ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } }, { status: 503 });
    }
    return publicVerificationJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  }
}
