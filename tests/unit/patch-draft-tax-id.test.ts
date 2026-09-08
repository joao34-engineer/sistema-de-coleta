import { describe, expect, it } from "vitest";
import { patchDraft } from "@/_pages/collection-drafts/api/drafts.server";

const collectionId = "22222222-2222-4222-8222-222222222222";

describe("patchDraft tax id mapping", () => {
  it("returns 422 invalid_signer_tax_id before calling the RPC", async () => {
    const response = await patchDraft(
      new Request(`http://localhost/api/collections/${collectionId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1, responsibleTaxId: "11111111111" }),
      }),
      collectionId,
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_signer_tax_id" });
  });

  it("keeps other schema failures as validation_error", async () => {
    const response = await patchDraft(
      new Request(`http://localhost/api/collections/${collectionId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 0, collectionLocation: "Rua" }),
      }),
      collectionId,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});
