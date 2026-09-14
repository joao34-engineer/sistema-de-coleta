import { describe, expect, it } from "vitest";
import { signatureDataUrlToPngFile } from "@/shared/lib/file/signature-data-url-to-png-file";

describe("signatureDataUrlToPngFile", () => {
  it("builds a PNG File from a SignaturePad data URL", async () => {
    const payload = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const base64 = Buffer.from(payload).toString("base64");
    const file = signatureDataUrlToPngFile(`data:image/png;base64,${base64}`);

    expect(file.name).toBe("signature.png");
    expect(file.type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(payload);
  });
});
