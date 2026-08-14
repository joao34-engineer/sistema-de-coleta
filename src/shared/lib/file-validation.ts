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
