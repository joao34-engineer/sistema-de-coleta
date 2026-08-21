import "server-only";

import QRCode from "qrcode";

const QR_SIZE = 256;

export async function renderVerificationQrPng(payload: string): Promise<Uint8Array> {
  const png = await QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: QR_SIZE,
    color: { dark: "#111827", light: "#ffffff" },
  });
  return new Uint8Array(png);
}

