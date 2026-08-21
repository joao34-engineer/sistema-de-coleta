import { describe, expect, it } from "vitest";
import { decideDocumentRetry, documentRetryDelayMs, isLeaseExpired } from "@/_pages/collection-documents/api/rendering/retry";
import { renderVerificationQrPng } from "@/_pages/collection-documents/api/rendering/qr-png.server";
import { renderDocumentJobArtifact } from "@/_pages/collection-documents/api/rendering/generation-saga.server";

const qrDocumentId = "11111111-1111-4111-8111-111111111111";
const qrDocumentSnapshot = {
  collection: {
    id: qrDocumentId,
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
    quantity: 1,
    condition_note: null,
    observation: null,
    position: 0,
    created_at: "2026-08-20T13:00:00-03:00",
    updated_at: "2026-08-20T13:00:00-03:00",
  }],
  evidences: [],
  signature: null,
  organization: { id: 1, display_name: "MJT Oficina" },
  issuer: {
    id: "55555555-5555-4555-8555-555555555555",
    legal_name: "MJT Oficina e Recuperacao LTDA",
    tax_id: "11222333000181",
    phone: "1133334444",
    street: "Rua Institucional",
    street_number: "42",
    address_complement: null,
    district: "Centro",
    city: "Sao Paulo",
    state_code: "SP",
    postal_code: "01001000",
    receipt_legal_text: "Esta guia registra a coleta dos itens.",
    signer_name: "Maria Emissora",
    signer_title: "Administradora",
    logo_asset_id: "66666666-6666-4666-8666-666666666666",
    logo_storage_path: "1/company-logo/66666666-6666-4666-8666-666666666666.png",
    logo_sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("document generation worker contracts", () => {
  it("uses capped exponential retry and detects expired leases", () => {
    expect(documentRetryDelayMs(1)).toBe(5_000);
    expect(documentRetryDelayMs(20)).toBe(60 * 60 * 1000);
    expect(decideDocumentRetry(2, new Date("2026-08-20T14:00:00.000Z")).availableAt).toBe("2026-08-20T14:00:10.000Z");
    expect(isLeaseExpired("2026-08-20T13:00:00.000Z", new Date("2026-08-20T13:05:00.000Z"))).toBe(true);
  });

  it("renders a real deterministic PNG for a verification URL", async () => {
    const payload = "https://mjt.example.com/verificar?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const first = await renderVerificationQrPng(payload);
    const second = await renderVerificationQrPng(payload);
    expect(first.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first.byteLength).toBeGreaterThan(100);
    expect(payload).not.toContain("Cliente Sintetico");
  });

  it("renders a QR artifact for a render_qr job", async () => {
    const result = await renderDocumentJobArtifact({
      id: "77777777-7777-4777-8777-777777777777",
      document_id: qrDocumentId,
      job_type: "render_qr",
      lease_token: "88888888-8888-4888-8888-888888888888",
      attempt_count: 1,
      leased_until: "2026-08-20T15:00:00.000Z",
    }, {
      id: qrDocumentId,
      organization_id: 1,
      snapshot: qrDocumentSnapshot,
      verification_token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      issued_at: "2026-08-20T14:00:00.000Z",
      version: 1,
    }, "https://mjt.example.com");

    expect(result.artifactType).toBe("qr");
    expect(result.bytes.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
