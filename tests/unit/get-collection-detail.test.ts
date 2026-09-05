import { beforeEach, describe, expect, it, vi } from "vitest";

const collectionId = "11111111-1111-4111-8111-111111111111";

const testState = vi.hoisted(() => ({
  rpcResult: { data: null as unknown, error: null as { code: string; message: string } | null },
  detailResult: null as unknown,
}));

vi.mock("@/shared/auth/require-admin", async () => {
  const actual = await vi.importActual<typeof import("@/shared/auth/require-admin")>("@/shared/auth/require-admin");
  return {
    ...actual,
    requireAuthenticatedAdministrator: async () => ({
      userId: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.com",
      fullName: "Admin",
      organizationId: 1,
      organizationDisplayName: "MJT",
    }),
  };
});

vi.mock("@/_pages/collection-lifecycle/api/lifecycle-supabase", () => ({
  createLifecycleSupabaseClient: async () => ({
    rpc: async () => testState.rpcResult,
  }),
}));

vi.mock("@/_pages/collection-lifecycle/index.server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/_pages/collection-lifecycle/index.server")>();
  return {
    ...original,
    getCollectionDetail: async () => testState.detailResult,
  };
});

import { collectionExistsAction } from "@/_pages/collection-drafts/api/actions";
import { getCollectionDetail } from "@/_pages/collection-lifecycle/api/queries";
import { GET } from "../../app/api/collections/[id]/route";

const routeContext = { params: Promise.resolve({ id: collectionId }) };

function resetState() {
  testState.rpcResult = { data: null, error: null };
  testState.detailResult = null;
}

describe("getCollectionDetail", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns null when SQL returns no row without throwing contract errors", async () => {
    testState.rpcResult = { data: null, error: null };
    await expect(getCollectionDetail(collectionId)).resolves.toBeNull();
  });

  it("throws collection_detail_contract_invalid when SQL payload fails schema", async () => {
    testState.rpcResult = { data: { notACollection: true }, error: null };
    await expect(getCollectionDetail(collectionId)).rejects.toThrow("collection_detail_contract_invalid");
  });
});

describe("GET /api/collections/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns 404 when collection detail is missing", async () => {
    testState.detailResult = null;
    const response = await GET(new Request(`https://mjt.example/api/collections/${collectionId}`), routeContext);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "collection_not_found", message: "Coleta não encontrada." },
    });
  });
});

describe("collectionExistsAction", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns false when the server has no collection row", async () => {
    testState.rpcResult = { data: null, error: null };
    await expect(collectionExistsAction(collectionId)).resolves.toBe(false);
  });

  it("returns false when getCollectionDetail throws", async () => {
    testState.rpcResult = { data: { notACollection: true }, error: null };
    await expect(collectionExistsAction(collectionId)).resolves.toBe(false);
  });
});
