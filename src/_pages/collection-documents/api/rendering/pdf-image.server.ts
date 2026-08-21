import "server-only";

import { deflateSync } from "node:zlib";
import sharp from "sharp";

import type { FrozenDocumentImage } from "./contracts";

export type EmbeddedPdfImage = Readonly<{
  width: number;
  height: number;
  compressedRgb: Uint8Array;
}>;

/**
 * Normalizes every allowed frozen image to opaque RGB pixels for PDF embedding.
 * This supports PNG, JPEG and WebP without ever embedding a Storage URL/path.
 */
export async function createEmbeddedPdfImage(asset: FrozenDocumentImage, maxEdge: number): Promise<EmbeddedPdfImage> {
  const rendered = await sharp(asset.bytes, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (rendered.info.width < 1 || rendered.info.height < 1 || rendered.info.channels !== 3) {
    throw new Error("frozen_document_image_invalid");
  }
  return {
    width: rendered.info.width,
    height: rendered.info.height,
    compressedRgb: new Uint8Array(deflateSync(rendered.data)) as Uint8Array<ArrayBuffer>,
  };
}
