import { describe, expect, it } from "vitest";
import { collectionQuerySchema } from "@/_pages/collection-lifecycle/model/contracts";

describe("Mobile Phase 3B Contract & Logic Tests", () => {
  it("validates collection query parameters schema", () => {
    const validQuery = collectionQuerySchema.parse({
      code: "MJT-2026-000001",
      customer: "Empresa Exemplo",
      status: "collected",
      limit: 25,
    });

    expect(validQuery.code).toBe("MJT-2026-000001");
    expect(validQuery.customer).toBe("Empresa Exemplo");
    expect(validQuery.status).toBe("collected");
    expect(validQuery.limit).toBe(25);
  });

  it("handles empty or default collection query filters", () => {
    const defaultQuery = collectionQuerySchema.parse({});
    expect(defaultQuery.limit).toBe(25);
    expect(defaultQuery.code).toBeUndefined();
    expect(defaultQuery.status).toBeUndefined();
  });

  it("formats WhatsApp share text correctly", () => {
    const documentId = "123e4567-e89b-12d3-a456-426614174000";
    const version = 1;
    const officialCode = "MJT-2026-000001";
    const origin = "https://mjt.example.com";

    const codeText = officialCode ? ` (${officialCode})` : "";
    const text = `Olá! Segue o recibo de coleta MJT${codeText} - Versão ${version}.\nVocê pode verificar a autenticidade e baixar o PDF em:\n${origin}/api/documents/${documentId}/download?artifact=pdf`;

    expect(text).toContain("MJT-2026-000001");
    expect(text).toContain("Versão 1");
    expect(text).toContain("/api/documents/123e4567-e89b-12d3-a456-426614174000/download?artifact=pdf");
  });
});
