import { describe, expect, it } from "vitest";
import { messageForQueueError, offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";

describe("messageForQueueError", () => {
  it("maps authentication_required to authExpired", () => {
    expect(messageForQueueError("authentication_required")).toBe(offlineCopy.authExpired);
  });

  it("maps stale_version to a short Portuguese sentence", () => {
    expect(messageForQueueError("stale_version")).toMatch(/atualizada/i);
    expect(messageForQueueError("stale_version")).not.toBe("stale_version");
  });

  it("maps other known codes to Portuguese", () => {
    expect(messageForQueueError("idempotency_conflict")).toMatch(/já foi enviada/i);
    expect(messageForQueueError("invalid_signature_file")).toMatch(/PNG/i);
    expect(messageForQueueError("collection_incomplete")).toMatch(/requisitos/i);
    expect(messageForQueueError("issuer_profile_incomplete")).toMatch(/emissor/i);
    expect(messageForQueueError("sync_interrupted")).toMatch(/interrompid/i);
    expect(messageForQueueError("collection_not_draft")).toBe(offlineCopy.discardOfficialKept);
  });

  it("returns the generic failed label for unknown codes and legacy Portuguese lastError", () => {
    expect(messageForQueueError("unknown_future_code")).toBe(offlineCopy.failed);
    expect(messageForQueueError("Não foi possível concluir a operação. Verifique a conexão e tente novamente.")).toBe(
      offlineCopy.failed,
    );
    expect(messageForQueueError("Sessão expirada. Entre novamente para continuar.")).toBe(offlineCopy.failed);
    expect(messageForQueueError(null)).toBe(offlineCopy.failed);
    expect(messageForQueueError(undefined)).toBe(offlineCopy.failed);
    expect(messageForQueueError("")).toBe(offlineCopy.failed);
  });

  it("never shows raw database text", () => {
    const message = messageForQueueError("column users.tax_id does not exist");
    expect(message).toBe(offlineCopy.failed);
    expect(message).not.toMatch(/tax_id|column/i);
  });
});
