import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocumentArtifactDownload, deliveryErrorResponse } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/collections/[id]/documents/[documentId]/download">) {
  const { documentId } = await context.params;
  const artifact = z.enum(["pdf", "qr"]).safeParse(new URL(request.url).searchParams.get("artifact") ?? "pdf");
  if (!z.uuid().safeParse(documentId).success || !artifact.success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    const signedUrl = await createDocumentArtifactDownload(documentId, artifact.data);
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
