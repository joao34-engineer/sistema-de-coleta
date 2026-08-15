export const logoMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMimeType = (typeof logoMimeTypes)[number];

type FileValidation = Readonly<{ valid: true; extension: "png" | "jpg" | "webp" } | { valid: false; message: string }>;

export function validateLogoFile(value: unknown): FileValidation {
  if (!(value instanceof File)) return { valid: false, message: "Selecione um arquivo de imagem." };
  if (value.size === 0 || value.size > 2 * 1024 * 1024) return { valid: false, message: "A imagem deve ter até 2 MB." };
  if (value.type === "image/png") return { valid: true, extension: "png" };
  if (value.type === "image/jpeg") return { valid: true, extension: "jpg" };
  if (value.type === "image/webp") return { valid: true, extension: "webp" };
  return { valid: false, message: "Use uma imagem PNG, JPEG ou WebP." };
}

export const evidenceMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export type EvidenceMimeType = (typeof evidenceMimeTypes)[number];

export type EvidenceFileValidation = Readonly<{ valid: true; extension: "png" | "jpg" | "webp"; sha256: string } | { valid: false; message: string }>;

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function isPng(bytes: Uint8Array): boolean {
  return hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isJpeg(bytes: Uint8Array): boolean {
  return hasSignature(bytes, [0xff, 0xd8, 0xff]);
}

function isWebp(bytes: Uint8Array): boolean {
  return hasSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export async function validateEvidenceFile(value: unknown): Promise<EvidenceFileValidation> {
  if (!(value instanceof File)) return { valid: false, message: "Selecione uma imagem." };
  if (value.size === 0 || value.size > 10 * 1024 * 1024) return { valid: false, message: "A imagem deve ter atÃ© 10 MB." };
  if (!evidenceMimeTypes.includes(value.type as EvidenceMimeType)) return { valid: false, message: "Use uma imagem PNG, JPEG ou WebP." };

  const bytes = new Uint8Array(await value.arrayBuffer());
  const fileKind = value.type === "image/png" ? "png" : value.type === "image/jpeg" ? "jpg" : "webp";
  const signatureMatches = fileKind === "png" ? isPng(bytes) : fileKind === "jpg" ? isJpeg(bytes) : isWebp(bytes);
  if (!signatureMatches) return { valid: false, message: "O conteÃºdo do arquivo nÃ£o corresponde ao tipo informado." };

  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { valid: true, extension: fileKind, sha256 };
}
