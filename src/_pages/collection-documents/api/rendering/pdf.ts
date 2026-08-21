import "server-only";

import type { CollectionDocumentSnapshot, FrozenDocumentAssets } from "./contracts";
import { sha256Hex } from "./canonical-json";
import { createEmbeddedPdfImage, type EmbeddedPdfImage } from "./pdf-image.server";

function ascii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
}

function pdfLiteral(value: string): string {
  return `(${ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")})`;
}

function line(value: string, x: number, y: number, size = 10): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td ${pdfLiteral(value)} Tj ET`;
}

function wrap(value: string, maxLength: number): string[] {
  const words = ascii(value).split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > maxLength && current.length > 0) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function pushWrapped(commands: string[], value: string, x: number, y: number, size: number, maxLength: number): number {
  for (const text of wrap(value, maxLength)) {
    commands.push(line(text, x, y, size));
    y -= size <= 8 ? 11 : 13;
  }
  return y;
}

const textEncoder = new TextEncoder();

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function textBytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function imageObject(image: EmbeddedPdfImage): Uint8Array {
  return concatBytes(
    textBytes(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.compressedRgb.byteLength} >>\nstream\n`),
    image.compressedRgb,
    textBytes("\nendstream"),
  );
}

function fitImage(image: EmbeddedPdfImage, maxWidth: number, maxHeight: number): Readonly<{ width: number; height: number }> {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function drawImage(commands: string[], name: string, image: EmbeddedPdfImage, x: number, y: number, maxWidth: number, maxHeight: number): void {
  const fitted = fitImage(image, maxWidth, maxHeight);
  commands.push(`q ${fitted.width.toFixed(3)} 0 0 ${fitted.height.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /${name} Do Q`);
}

type PdfImages = Readonly<{
  qr: EmbeddedPdfImage;
  logo?: EmbeddedPdfImage | undefined;
  signature?: EmbeddedPdfImage | undefined;
}>;

async function renderImages(qrPng: Uint8Array, frozenAssets?: FrozenDocumentAssets): Promise<PdfImages> {
  const qr = await createEmbeddedPdfImage({ bytes: qrPng as Uint8Array<ArrayBuffer>, contentType: "image/png", sha256: sha256Hex(qrPng) }, 256);
  const [logo, signature] = await Promise.all([
    frozenAssets?.logo ? createEmbeddedPdfImage(frozenAssets.logo, 256) : Promise.resolve(undefined),
    frozenAssets?.signature ? createEmbeddedPdfImage(frozenAssets.signature, 512) : Promise.resolve(undefined),
  ]);
  return { qr, logo, signature };
}

/**
 * Emits a deterministic, self-contained PDF. Images originate only from the
 * QR payload or frozen document bytes; no current setting, signed URL or
 * Storage path is represented in the output.
 */
export async function renderCollectionPdf(
  snapshot: CollectionDocumentSnapshot,
  documentVersion: number,
  verificationUrl: string,
  snapshotHash: string,
  qrPng: Uint8Array,
  frozenAssets?: FrozenDocumentAssets,
): Promise<Uint8Array> {
  const images = await renderImages(qrPng, frozenAssets);
  const issuer = snapshot.issuer;
  const commands: string[] = [
    line("MJT - GUIA DE COLETA", 48, 800, 16),
    line("Este documento e uma guia de coleta, nao um documento fiscal.", 48, 778, 9),
  ];
  if (images.logo) drawImage(commands, "ImLogo", images.logo, 432, 746, 115, 58);
  drawImage(commands, "ImQr", images.qr, 452, 626, 94, 94);

  let y = 752;
  y = pushWrapped(commands, `Emissor: ${issuer.legal_name}`, 48, y, 10, 64);
  y = pushWrapped(commands, `CNPJ: ${issuer.tax_id}   Telefone: ${issuer.phone}`, 48, y, 9, 70);
  const address = [
    `${issuer.street}, ${issuer.street_number}`,
    issuer.address_complement,
    issuer.district,
    `${issuer.city}/${issuer.state_code}`,
    `CEP ${issuer.postal_code}`,
  ].filter((part): part is string => part !== null && part !== undefined && part.length > 0).join(" - ");
  y = pushWrapped(commands, `Endereco: ${address}`, 48, y, 9, 70);
  y = pushWrapped(commands, `Responsavel pela emissao: ${issuer.signer_name} (${issuer.signer_title})`, 48, y, 9, 70);
  y = pushWrapped(commands, `Texto juridico: ${issuer.receipt_legal_text}`, 48, y, 8, 70);
  y -= 8;
  commands.push(line(`Codigo: ${snapshot.collection.official_code}`, 48, y, 11));
  y -= 17;
  commands.push(line(`Versao: ${documentVersion}   Emissao: ${snapshot.collection.collected_at}`, 48, y, 9));
  y -= 19;
  commands.push(line(`Cliente: ${snapshot.customer.legal_name}`, 48, y, 10));
  y -= 17;
  commands.push(line(`Local: ${snapshot.collection.location}`, 48, y, 9));
  y -= 17;
  commands.push(line(`Responsavel: ${snapshot.collection.responsible_name}`, 48, y, 9));
  y -= 30;
  commands.push(line("Itens coletados", 48, y, 11));
  y -= 18;
  for (const [index, item] of snapshot.items.entries()) {
    for (const text of wrap(`${index + 1}. ${item.description} (quantidade: ${item.quantity})`, 90)) {
      commands.push(line(text, 58, y, 9));
      y -= 13;
    }
    if (item.condition_note) {
      for (const text of wrap(`Condicao: ${item.condition_note}`, 84)) {
        commands.push(line(text, 72, y, 8));
        y -= 12;
      }
    }
    if (item.observation) {
      for (const text of wrap(`Observacao: ${item.observation}`, 82)) {
        commands.push(line(text, 72, y, 8));
        y -= 12;
      }
    }
    y -= 4;
  }
  y = Math.max(y, 190);
  commands.push(line("Declaracao", 48, y, 11));
  y -= 18;
  y = pushWrapped(commands, "A coleta foi conferida pelo responsavel identificado. Este comprovante registra apenas a retirada dos itens.", 48, y, 8, 100);
  if (snapshot.signature) {
    commands.push(line(`Aceite: ${snapshot.signature.acceptance_text}`, 48, y - 8, 8));
    commands.push(line(`Assinante: ${snapshot.signature.signer_name}`, 48, y - 21, 8));
  }
  if (images.signature) drawImage(commands, "ImSignature", images.signature, 350, 90, 185, 70);
  commands.push(line(`Hash do snapshot: ${snapshotHash}`, 48, 72, 7));
  commands.push(line(`Verificacao: ${verificationUrl}`, 48, 58, 7));

  const imageNames = ["ImQr", ...(images.logo ? ["ImLogo"] : []), ...(images.signature ? ["ImSignature"] : [])];
  const xObjects = imageNames.map((name, index) => `/${name} ${6 + index} 0 R`).join(" ");
  const stream = `${commands.join("\n")}\n`;
  const objects: Uint8Array[] = [
    textBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << ${xObjects} >> >> /Contents 5 0 R >>`),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    textBytes(`<< /Length ${textBytes(stream).byteLength} >>\nstream\n${stream}endstream`),
    imageObject(images.qr),
    ...(images.logo ? [imageObject(images.logo)] : []),
    ...(images.signature ? [imageObject(images.signature)] : []),
  ];
  const header = textBytes("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  const chunks: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let length = header.byteLength;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const prefix = textBytes(`${index + 1} 0 obj\n`);
    const suffix = textBytes("\nendobj\n");
    chunks.push(prefix, object, suffix);
    length += prefix.byteLength + object.byteLength + suffix.byteLength;
  }
  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  chunks.push(textBytes(xref));
  return concatBytes(...chunks);
}

export function hashPdf(pdfBytes: Uint8Array): string {
  return sha256Hex(pdfBytes);
}
