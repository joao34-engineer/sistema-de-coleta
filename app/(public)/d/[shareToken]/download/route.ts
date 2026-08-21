import { NextResponse } from "next/server";
import { consumeDocumentShare, createConsumedShareDownload } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

function unavailableResponse() {
  return noStoreJson({ error: { code: "not_found", message: "Link indisponível." } }, { status: 404, headers: { "Referrer-Policy": "no-referrer" } });
}

export async function GET(_request: Request, context: RouteContext<"/d/[shareToken]/download">) {
  const { shareToken } = await context.params;
  if (!/^[0-9a-f]{64}$/.test(shareToken)) return unavailableResponse();
  try {
    const share = await consumeDocumentShare(shareToken);
    if (!share.valid) return unavailableResponse();
    const signedUrl = await createConsumedShareDownload(share);
    if (!signedUrl) return unavailableResponse();
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return unavailableResponse();
  }
}

