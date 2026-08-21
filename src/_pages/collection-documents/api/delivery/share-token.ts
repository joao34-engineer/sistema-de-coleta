import "server-only";

import { timingSafeEqual } from "node:crypto";
import { sha256Hex } from "../rendering/canonical-json";

export const documentShareTokenPattern = /^[0-9a-f]{64}$/;

export function isDocumentShareToken(value: string): boolean {
  return documentShareTokenPattern.test(value);
}

export function hashDocumentShareToken(token: string): string {
  if (!isDocumentShareToken(token)) throw new Error("document_share_token_invalid");
  return sha256Hex(token);
}

export function matchesDocumentShareTokenHash(token: string, expectedHash: string): boolean {
  if (!isDocumentShareToken(token) || !/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  const actualBytes = Buffer.from(hashDocumentShareToken(token), "hex");
  const expectedBytes = Buffer.from(expectedHash, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function buildDocumentShareUrl(baseUrl: string, token: string): string {
  if (!isDocumentShareToken(token)) throw new Error("document_share_token_invalid");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("document_share_base_url_invalid");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/d/${token}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
