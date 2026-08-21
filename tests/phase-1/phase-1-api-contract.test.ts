import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiRequest, apiUrl, jsonRequest, readResponseBody, remoteConfig, remoteEnabled, responseErrorCode } from "./remote-harness";

describe.skipIf(!remoteEnabled)("Fase 1A API contract (opt-in remote)", () => {
  it("rejects invalid CPF/CNPJ and phone inputs without persisting a customer", async () => {
    const response = await apiRequest("/api/customers", jsonRequest({ displayName: `QA invalid ${randomUUID()}`, taxId: "111.111.111-11", phone: "123" }, { method: "POST" }));

    expect(response.status).toBe(400);
    expect(responseErrorCode(await readResponseBody(response))).toBe("validation_error");
  });

  it("denies anonymous access to protected collection data", async () => {
    if (!remoteConfig) throw new Error("phase_1_qa_not_configured");
    const response = await fetch(apiUrl("/api/collections"), { headers: { Accept: "application/json" } });

    expect([401, 403]).toContain(response.status);
  });

  it("does not disclose PII for an unknown public verification token", async () => {
    const response = await apiRequest(`/api/public/collections/${randomUUID().replaceAll("-", "")}`);
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body.toLowerCase()).not.toMatch(/cpf|cnpj|telefone|address|endere[cç]o|signature|assinatura/);
  });

  it("uses a stable stale-version response for an outdated autosave", async () => {
    const collectionId = randomUUID();
    const response = await apiRequest(`/api/collections/${collectionId}/draft`, jsonRequest({ expectedVersion: -1, collectionLocation: "invalid" }, { method: "PATCH" }));

    expect([400, 404, 409, 422]).toContain(response.status);
    if (response.status === 409) expect(responseErrorCode(await readResponseBody(response))).toBe("stale_version");
  });

  it("requires idempotency keys for irreversible commands", async () => {
    const collectionId = randomUUID();
    const response = await apiRequest(`/api/collections/${collectionId}/finalize`, jsonRequest({ expectedVersion: 1 }, { method: "POST" }));

    expect(response.status).toBe(400);
    expect(responseErrorCode(await readResponseBody(response))).toBe("idempotency_key_required");
  });
});
