import { NextResponse } from "next/server";
import { consumeDocumentShare, createConsumedShareDownload, inspectDocumentShare } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";
import {
  DocumentRateLimitExceededError,
  DocumentRateLimitUnavailableError,
  enforceShareDownloadRateLimit,
} from "@/shared/lib/rate-limit.server";

export const dynamic = "force-dynamic";

function isDocumentNavigation(request: Request): boolean {
  if (request.headers.get("Sec-Fetch-Dest") === "document") return true;
  const accept = request.headers.get("Accept");
  return accept !== null && accept.includes("text/html");
}

function unavailableResponse() {
  return noStoreJson({ error: { code: "not_found", message: "Link indisponível." } }, { status: 404, headers: { "Referrer-Policy": "no-referrer" } });
}

function rateLimitExceededResponse(retryAfterSeconds: number, request: Request) {
  const headers = {
    "Retry-After": String(Math.max(1, retryAfterSeconds)),
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  if (isDocumentNavigation(request)) {
    return new NextResponse("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Aguarde</title></head><body><p>Aguarde antes de tentar novamente.</p></body></html>", {
      status: 429,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return noStoreJson({ error: { code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." } }, { status: 429, headers });
}

function rateLimitUnavailableResponse(request: Request) {
  const headers = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };
  if (isDocumentNavigation(request)) {
    return new NextResponse("<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Indisponível</title></head><body><p>Consulta temporariamente indisponível.</p></body></html>", {
      status: 503,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return noStoreJson({ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } }, { status: 503, headers });
}

export async function GET(request: Request, context: RouteContext<"/d/[shareToken]/download">) {
  const { shareToken } = await context.params;
  if (!/^[0-9a-f]{64}$/.test(shareToken)) return unavailableResponse();
  try {
    await enforceShareDownloadRateLimit(request);
    const share = await inspectDocumentShare(shareToken);
    if (!share.valid) return unavailableResponse();
    if (share.shareType !== "pdf") return unavailableResponse();
    const signedUrl = await createConsumedShareDownload(share);
    if (!signedUrl) return unavailableResponse();
    const consumed = await consumeDocumentShare(shareToken);
    if (!consumed.valid) return unavailableResponse();
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return rateLimitExceededResponse(error.retryAfterSeconds, request);
    }
    if (error instanceof DocumentRateLimitUnavailableError) {
      return rateLimitUnavailableResponse(request);
    }
    return unavailableResponse();
  }
}
