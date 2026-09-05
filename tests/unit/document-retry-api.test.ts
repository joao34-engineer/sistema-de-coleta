import { describe, expect, it, vi } from "vitest";

const collectionId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

const testState = vi.hoisted(() => ({
  authError: null as Error | null,
  adminError: null as Error | null,
  retryError: null as { code: string; message: string } | null,
  retryResult: {
    jobId: "33333333-3333-4333-8333-333333333333",
    documentId: "22222222-2222-4222-8222-222222222222",
    jobType: "render_pdf" as const,
    status: "queued" as const,
    alreadyReady: false,
  },
  kickCalls: 0,
}));

vi.mock("@/_pages/collection-documents/api/delivery/index.server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/_pages/collection-documents/api/delivery/index.server")>();
  return {
    ...original,
    retryDocumentJob: async () => {
      if (testState.authError) throw testState.authError;
      if (testState.adminError) throw testState.adminError;
      if (testState.retryError) {
        throw testState.retryError;
      }
      return testState.retryResult;
    },
  };
});

vi.mock("@/_app/lib/schedule-document-render-kick", () => ({
  scheduleDocumentRenderKick: () => {
    testState.kickCalls += 1;
  },
}));

import { AuthenticationRequiredError, AdministratorAccessDeniedError } from "@/shared/auth/require-admin";
import { POST } from "../../app/api/collections/[id]/documents/[documentId]/retry/route";

const routeContext = { params: Promise.resolve({ id: collectionId, documentId }) };

function resetState() {
  testState.authError = null;
  testState.adminError = null;
  testState.retryError = null;
  testState.retryResult = {
    jobId,
    documentId,
    jobType: "render_pdf",
    status: "queued",
    alreadyReady: false,
  };
  testState.kickCalls = 0;
}

describe("document retry API", () => {
  it("returns 401 when authentication is required", async () => {
    resetState();
    testState.authError = new AuthenticationRequiredError();
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "authentication_required", message: "É necessário entrar para continuar." },
    });
  });

  it("returns 403 when the caller is not an administrator", async () => {
    resetState();
    testState.adminError = new AdministratorAccessDeniedError();
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Acesso não autorizado." },
    });
  });

  it("returns 404 when the document is outside the collection scope", async () => {
    resetState();
    testState.retryError = { code: "P0002", message: "document_not_found" };
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "not_found", message: "Documento não encontrado." },
    });
  });

  it("returns 422 when a live lease is still in progress", async () => {
    resetState();
    testState.retryError = { code: "P0001", message: "document_job_in_progress" };
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "document_job_in_progress", message: "A geração do PDF ainda está em andamento." },
    });
  });

  it("returns 200 queued and kicks the worker once", async () => {
    resetState();
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        jobId,
        documentId,
        jobType: "render_pdf",
        status: "queued",
        alreadyReady: false,
      },
    });
    expect(testState.kickCalls).toBe(1);
    expect(JSON.stringify(body)).not.toContain("DOCUMENT_WORKER_SECRET");
    expect(JSON.stringify(body)).not.toContain("storage_path");
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{64}/);
  });

  it("returns 200 alreadyReady without kicking the worker", async () => {
    resetState();
    testState.retryResult = {
      jobId,
      documentId,
      jobType: "render_pdf",
      status: "succeeded",
      alreadyReady: true,
    };
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        jobId,
        documentId,
        jobType: "render_pdf",
        status: "succeeded",
        alreadyReady: true,
      },
    });
    expect(testState.kickCalls).toBe(0);
  });

  it("no longer returns the legacy document_retry_not_available stub", async () => {
    resetState();
    const response = await POST(new Request("https://mjt.example/api/retry", { method: "POST" }), routeContext);
    const body = await response.json();
    expect(response.status).not.toBe(422);
    expect(body).not.toEqual({
      error: {
        code: "document_retry_not_available",
        message: "A geração é retomada pelo worker com lease idempotente.",
      },
    });
  });

  it("returns 422 for invalid UUIDs", async () => {
    resetState();
    const response = await POST(
      new Request("https://mjt.example/api/retry", { method: "POST" }),
      { params: Promise.resolve({ id: "not-a-uuid", documentId }) },
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "validation_error", message: "Revise os dados enviados." },
    });
  });
});
