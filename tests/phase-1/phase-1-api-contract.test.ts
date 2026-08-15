import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const baseUrl = process.env["PHASE_1_QA_BASE_URL"]?.replace(/\/$/, "");
const bearerToken = process.env["PHASE_1_QA_BEARER_TOKEN"];
const remoteEnabled = Boolean(baseUrl && bearerToken);

type ApiError = Readonly<{ error?: Readonly<{ code?: unknown }> }>;

function endpoint(path: string): string {
  if (!baseUrl) throw new Error("phase_1_qa_base_url_missing");
  return `${baseUrl}${path}`;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: bearerToken ? `Bearer ${bearerToken}` : "",
      ...init.headers,
    },
  });
}

async function readJson(response: Response): Promise<ApiError> {
  return (await response.json()) as ApiError;
}

function expectErrorCode(body: ApiError, code: string): void {
  expect(body.error?.code).toBe(code);
}

describe.skipIf(!remoteEnabled)("Fase 1A API contract (opt-in remote)", () => {
  it("rejects invalid CPF/CNPJ and phone inputs without persisting a customer", async () => {
    const response = await request("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `QA invalid ${randomUUID()}`,
        taxId: "111.111.111-11",
        phone: "123",
      }),
    });

    expect(response.status).toBe(400);
    expectErrorCode(await readJson(response), "validation_error");
  });

  it("denies anonymous access to protected collection data", async () => {
    if (!baseUrl) throw new Error("phase_1_qa_base_url_missing");
    const response = await fetch(`${baseUrl}/api/collections`, { headers: { Accept: "application/json" } });

    expect([401, 403]).toContain(response.status);
  });

  it("does not disclose PII for an unknown public verification token", async () => {
    const response = await request(`/api/public/collections/${randomUUID().replaceAll("-", "")}`);
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body.toLowerCase()).not.toMatch(/cpf|cnpj|telefone|address|endere[cç]o|signature|assinatura/);
  });

  it("uses a stable stale-version response for an outdated autosave", async () => {
    const collectionId = randomUUID();
    const response = await request(`/api/collections/${collectionId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: -1 }),
    });

    expect([404, 409]).toContain(response.status);
    if (response.status === 409) expectErrorCode(await readJson(response), "stale_version");
  });

  it("requires idempotency keys for irreversible commands", async () => {
    const collectionId = randomUUID();
    const response = await request(`/api/collections/${collectionId}/finalize`, { method: "POST" });

    expect(response.status).toBe(400);
    expectErrorCode(await readJson(response), "idempotency_key_required");
  });
});
