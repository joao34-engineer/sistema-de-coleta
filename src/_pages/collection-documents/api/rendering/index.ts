import { z } from "zod";
import { documentRenderInputSchema, type RenderedDocument } from "./contracts";
import { canonicalizeSnapshot, hashCanonicalSnapshot, sha256Hex } from "./canonical-json";
import { createQrPayload } from "./qr-payload";
import { renderVerificationQrPng } from "./qr-png.server";

export { canonicalizeSnapshot, hashCanonicalSnapshot, sha256Hex } from "./canonical-json";
export { documentRenderInputSchema } from "./contracts";
export { createQrPayload, createVerificationUrl } from "./qr-payload";
export { renderVerificationQrPng } from "./qr-png.server";
export type { CollectionDocumentSnapshot, DocumentRenderInput, FrozenDocumentAssets, FrozenDocumentImage, RenderedDocument } from "./contracts";

function assertFrozenAssetHashes(input: ReturnType<typeof documentRenderInputSchema.parse>): void {
  const assets = input.frozenAssets;
  if (assets?.logo) {
    if (assets.logo.sha256 !== sha256Hex(assets.logo.bytes) || assets.logo.sha256 !== input.snapshot.issuer.logo_sha256) {
      throw new Error("frozen_logo_hash_mismatch");
    }
  }
  if (assets?.signature) {
    if (
      input.snapshot.signature === null
      || assets.signature.sha256 !== sha256Hex(assets.signature.bytes)
      || assets.signature.sha256 !== input.snapshot.signature.sha256
    ) {
      throw new Error("frozen_signature_hash_mismatch");
    }
  }
}

export async function renderCollectionDocument(input: unknown): Promise<RenderedDocument> {
  const parsed = documentRenderInputSchema.parse(input);
  assertFrozenAssetHashes(parsed);
  const canonicalSnapshot = canonicalizeSnapshot(parsed.snapshot);
  const snapshotHash = hashCanonicalSnapshot(parsed.snapshot);
  const qrPayload = createQrPayload(parsed);
  const qrPng = await renderVerificationQrPng(qrPayload);
  const { hashPdf, renderCollectionPdf } = await import("./pdf");
  const pdfBytes = await renderCollectionPdf(parsed.snapshot, parsed.documentVersion, qrPayload, snapshotHash, qrPng, parsed.frozenAssets);
  return {
    documentVersion: parsed.documentVersion,
    snapshot: parsed.snapshot,
    canonicalSnapshot,
    snapshotHash,
    verificationUrl: qrPayload,
    qrPayload,
    pdfBytes,
    pdfSha256: hashPdf(pdfBytes),
    contentType: "application/pdf",
    filename: `${parsed.snapshot.collection.official_code}-v${parsed.documentVersion}.pdf`,
  };
}

export async function safeRenderCollectionDocument(input: unknown): Promise<
  | Readonly<{ success: true; data: RenderedDocument }>
  | Readonly<{ success: false; error: z.ZodError }>
> {
  const parsed = documentRenderInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: await renderCollectionDocument(parsed.data) };
}
