import { describe, expect, it } from "vitest";
import { canonicalizeSnapshot, documentRenderInputSchema, hashCanonicalSnapshot, renderCollectionDocument, renderVerificationQrPng, sha256Hex } from "@/_pages/collection-documents/api/rendering";

const snapshot = {
  collection: {
    id: "11111111-1111-4111-8111-111111111111",
    official_code: "MJT-2026-000123",
    status: "collected" as const,
    location: "Rua das Flores, 10",
    responsible_name: "Ana Responsavel",
    responsible_tax_id: "52998224725",
    collected_at: "2026-08-20T14:00:00-03:00",
    issued_year: 2026,
    sequence_number: 123,
    row_version: 3,
  },
  customer: {
    id: "22222222-2222-4222-8222-222222222222",
    legal_name: "Cliente Sintetico LTDA",
    tax_id: "11222333000181",
    phone: "11999998888",
  },
  items: [{
    id: "33333333-3333-4333-8333-333333333333",
    description: "Equipamento de teste",
    quantity: 2,
    condition_note: "Usado",
    observation: "Sem observacoes",
    position: 0,
    created_at: "2026-08-20T13:00:00-03:00",
    updated_at: "2026-08-20T13:00:00-03:00",
  }],
  evidences: [],
  signature: {
    id: "44444444-4444-4444-8444-444444444444",
    signer_name: "Ana Responsavel",
    signer_tax_id: "52998224725",
    acceptance_text: "Confirmo a conferencia dos itens coletados.",
    storage_path: "1/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.png",
    byte_size: 128,
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    signed_at: "2026-08-20T14:01:00-03:00",
  },
  organization: { id: 1, display_name: "MJT Oficina" },
  issuer: {
    id: "55555555-5555-4555-8555-555555555555",
    legal_name: "MJT Oficina e Recuperacao LTDA",
    tax_id: "11222333000181",
    phone: "1133334444",
    street: "Rua Institucional",
    street_number: "42",
    address_complement: "Sala 3",
    district: "Centro",
    city: "Sao Paulo",
    state_code: "SP",
    postal_code: "01001000",
    receipt_legal_text: "Esta guia registra a coleta dos itens e nao substitui documento fiscal.",
    signer_name: "Maria Emissora",
    signer_title: "Administradora",
    logo_asset_id: "66666666-6666-4666-8666-666666666666",
    logo_storage_path: "1/company-logo/66666666-6666-4666-8666-666666666666.png",
    logo_sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  },
};

const input = {
  snapshot,
  documentVersion: 1,
  verificationToken: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  verificationBaseUrl: "https://mjt.example.com",
};

describe("collection document rendering", () => {
  it("rejects unknown input fields at the rendering boundary", () => {
    const result = documentRenderInputSchema.safeParse({ ...input, secret: "must not enter" });
    expect(result.success).toBe(false);
  });

  it("canonicalizes object key order and hashes the canonical snapshot", () => {
    const reordered = { ...snapshot, organization: { display_name: snapshot.organization.display_name, id: snapshot.organization.id } };
    expect(canonicalizeSnapshot(snapshot)).toBe(canonicalizeSnapshot(reordered));
    expect(hashCanonicalSnapshot(snapshot)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("renders deterministic PDF bytes and a privacy-minimal QR URL", async () => {
    const first = await renderCollectionDocument(input);
    const second = await renderCollectionDocument(input);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(Array.from(first.pdfBytes)).toEqual(Array.from(second.pdfBytes));
    expect(new TextDecoder().decode(first.pdfBytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(first.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.verificationUrl).toContain("/verificar/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(first.qrPayload).not.toContain(snapshot.customer.legal_name);
    expect(first.qrPayload).not.toContain(snapshot.customer.tax_id);
    expect(first.qrPayload).not.toContain(snapshot.customer.phone);
  });

  it("embeds QR, frozen logo and frozen signature images without exposing Storage paths", async () => {
    const logo = await renderVerificationQrPng("https://mjt.example.com/frozen-logo");
    const signature = await renderVerificationQrPng("https://mjt.example.com/frozen-signature");
    const frozenInput = {
      ...input,
      snapshot: {
        ...snapshot,
        issuer: { ...snapshot.issuer, logo_sha256: sha256Hex(logo) },
        signature: snapshot.signature === null ? null : { ...snapshot.signature, sha256: sha256Hex(signature) },
      },
      frozenAssets: {
        logo: { bytes: logo, contentType: "image/png" as const, sha256: sha256Hex(logo) },
        signature: { bytes: signature, contentType: "image/png" as const, sha256: sha256Hex(signature) },
      },
    };
    const rendered = await renderCollectionDocument(frozenInput);
    const pdfText = new TextDecoder().decode(rendered.pdfBytes);
    expect((pdfText.match(/\/Subtype \/Image/g) ?? []).length).toBe(3);
    expect(pdfText).toContain("/ImQr Do");
    expect(pdfText).toContain("/ImLogo Do");
    expect(pdfText).toContain("/ImSignature Do");
    expect(pdfText).not.toContain(snapshot.issuer.logo_storage_path);
    expect(pdfText).not.toContain(snapshot.signature?.storage_path ?? "");
    expect(rendered.snapshot.issuer.legal_name).toBe(snapshot.issuer.legal_name);
    expect(pdfText).toContain("MJT Oficina e Recuperacao LTDA");
    expect(pdfText).toContain("11222333000181");
    expect(pdfText).toContain("1133334444");
    expect(pdfText).toContain("Rua Institucional");
    expect(pdfText).toContain("Centro");
    expect(pdfText).toContain("Sao Paulo/SP");
    expect(pdfText).toContain("01001000");
    expect(pdfText).toContain("Esta guia registra a coleta dos itens");
    expect(pdfText).toContain("Maria Emissora");
    expect(pdfText).toContain("Administradora");
  });

  it("keeps a prior PDF tied to its frozen logo even when a future logo exists", async () => {
    const frozenLogo = await renderVerificationQrPng("https://mjt.example.com/logo-v1");
    const futureLogo = await renderVerificationQrPng("https://mjt.example.com/logo-v2");
    const frozenInput = {
      ...input,
      snapshot: { ...snapshot, issuer: { ...snapshot.issuer, logo_sha256: sha256Hex(frozenLogo) } },
      frozenAssets: { logo: { bytes: frozenLogo, contentType: "image/png" as const, sha256: sha256Hex(frozenLogo) } },
    };
    const first = await renderCollectionDocument(frozenInput);
    expect(sha256Hex(futureLogo)).not.toBe(frozenInput.snapshot.issuer.logo_sha256);
    const repeated = await renderCollectionDocument(frozenInput);
    expect(Array.from(repeated.pdfBytes)).toEqual(Array.from(first.pdfBytes));
  });

  it("rejects image bytes whose claimed frozen hash does not match the snapshot", async () => {
    const logo = await renderVerificationQrPng("https://mjt.example.com/logo-integrity");
    await expect(renderCollectionDocument({
      ...input,
      frozenAssets: { logo: { bytes: logo, contentType: "image/png", sha256: "d".repeat(64) } },
    })).rejects.toThrow("frozen_logo_hash_mismatch");
  });
});
