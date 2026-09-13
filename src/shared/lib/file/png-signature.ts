const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PNG_SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export function isPngHeader(bytes: Uint8Array): boolean {
  return PNG_HEADER.every((value, index) => bytes[index] === value);
}

export function validatePngSignature(file: unknown): file is File {
  if (!(file instanceof File) || file.type !== "image/png" || file.size === 0 || file.size > PNG_SIGNATURE_MAX_BYTES) return false;
  return true;
}

export async function assertPngSignatureHeader(file: File): Promise<void> {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (header.length !== PNG_HEADER.length || !isPngHeader(header)) throw new Error("invalid_signature_file");
}
