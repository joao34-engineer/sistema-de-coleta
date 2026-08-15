import { z } from "zod";
import { verifyCollectionDocument } from "@/_pages/collection-documents/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export async function GET(_request: Request, context: RouteContext<"/api/public/collections/[verificationToken]">) {
  const { verificationToken } = await context.params;
  const parsed = tokenSchema.safeParse(verificationToken);
  if (!parsed.success) return noStoreJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  try {
    const verification = await verifyCollectionDocument(parsed.data);
    return verification ? noStoreJson(verification) : noStoreJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  } catch {
    return noStoreJson({ error: { code: "not_found", message: "Registro não encontrado." } }, { status: 404 });
  }
}
