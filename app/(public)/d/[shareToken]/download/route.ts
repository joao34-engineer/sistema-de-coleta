import { NextResponse } from "next/server";
import { consumeDocumentShare, createConsumedShareDownload } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";
import {
  DocumentRateLimitExceededError,
  DocumentRateLimitUnavailableError,
  enforceShareDownloadRateLimit,
} from "@/shared/lib/rate-limit.server";

export const dynamic = "force-dynamic";

function unavailableResponse() {
  return noStoreJson({ error: { code: "not_found", message: "Link indisponível." } }, { status: 404, headers: { "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: Request, context: RouteContext<"/d/[shareToken]/download">) {
  const { shareToken } = await context.params;
  if (!/^[0-9a-f]{64}$/.test(shareToken)) return unavailableResponse();
  try {
    await enforceShareDownloadRateLimit(request);
    const share = await consumeDocumentShare(shareToken);
    if (!share.valid) return unavailableResponse();
    const signedUrl = await createConsumedShareDownload(share);
    if (!signedUrl) return unavailableResponse();
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return noStoreJson({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." } }, {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, error.retryAfterSeconds)), "Referrer-Policy": "no-referrer" },
      });
    }
    if (error instanceof DocumentRateLimitUnavailableError) {
      return noStoreJson({ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } }, {
        status: 503,
        headers: { "Referrer-Policy": "no-referrer" },
      });
    }
    return unavailableResponse();
  }
}
