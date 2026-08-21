import type { DocumentRenderInput } from "./contracts";

export function createVerificationUrl(input: DocumentRenderInput): string {
  const url = new URL(input.verificationBaseUrl);
  if (url.search || url.hash) throw new Error("A URL base de verificação não pode conter query ou fragmento.");
  const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = `${pathname}/verificar/${input.verificationToken}`;
  return url.toString();
}

/**
 * QR público carrega somente uma URL com token de alta entropia. Os dados do
 * cliente, itens, assinatura e evidências permanecem no snapshot privado.
 */
export function createQrPayload(input: DocumentRenderInput): string {
  return createVerificationUrl(input);
}
