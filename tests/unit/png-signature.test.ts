import { describe, expect, it } from "vitest";
import { assertPngSignatureHeader, validatePngSignature } from "@/shared/lib/file/png-signature";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff]);

describe("validatePngSignature", () => {
  it("accepts a PNG MIME type within the 2 MiB limit", () => {
    expect(validatePngSignature(new File([pngHeader], "signature.png", { type: "image/png" }))).toBe(true);
  });

  it("rejects jpeg MIME, empty files, and oversized files", () => {
    expect(validatePngSignature(new File([jpegHeader], "signature.jpg", { type: "image/jpeg" }))).toBe(false);
    expect(validatePngSignature(new File([], "empty.png", { type: "image/png" }))).toBe(false);
    expect(validatePngSignature(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }))).toBe(false);
  });
});

describe("assertPngSignatureHeader", () => {
  it("accepts the PNG magic bytes", async () => {
    await expect(assertPngSignatureHeader(new File([pngHeader], "signature.png", { type: "image/png" }))).resolves.toBeUndefined();
  });

  it("rejects jpeg bytes with invalid_signature_file", async () => {
    await expect(assertPngSignatureHeader(new File([jpegHeader], "spoof.png", { type: "image/png" }))).rejects.toThrow("invalid_signature_file");
  });
});
