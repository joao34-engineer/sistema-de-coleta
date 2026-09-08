import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toOperationsApiError } from "@/_pages/collection-operations/api/operations-errors";

describe("operations API delivery item codes (5.5)", () => {
  it("maps duplicate and already-delivered codes to 409 with Portuguese copy", () => {
    expect(toOperationsApiError({ code: "P0001", message: "duplicate_delivery_item" })).toMatchObject({
      status: 409,
      code: "duplicate_delivery_item",
      message: "O mesmo item foi informado mais de uma vez na entrega.",
    });
    expect(toOperationsApiError({ code: "P0001", message: "item_already_delivered" })).toMatchObject({
      status: 409,
      code: "item_already_delivered",
      message: "Um ou mais itens já foram entregues em um termo anterior.",
    });
  });

  it("keeps PR 9 check-in codes on 422", () => {
    expect(toOperationsApiError({ code: "P0001", message: "duplicate_workshop_item" })).toMatchObject({
      status: 422,
      code: "duplicate_workshop_item",
    });
    expect(toOperationsApiError({ code: "P0001", message: "workshop_checkin_items_incomplete" })).toMatchObject({
      status: 422,
      code: "workshop_checkin_items_incomplete",
    });
  });

  it("maps duplicate_budget_item to 422 above the generic P0001 fallback", () => {
    expect(toOperationsApiError({ code: "P0001", message: "duplicate_budget_item" })).toEqual({
      status: 422,
      code: "duplicate_budget_item",
      message: "O mesmo item não pode ser informado mais de uma vez no orçamento.",
      actorId: null,
    });
  });

  it("maps item_not_ready to 422 above the generic P0001 fallback", () => {
    expect(toOperationsApiError({ code: "P0001", message: "item_not_ready" })).toEqual({
      status: 422,
      code: "item_not_ready",
      message: "Somente itens marcados como Pronto podem ser entregues.",
      actorId: null,
    });
  });
});

describe("operations API cancel draft codes", () => {
  it("maps collection_not_cancelable_draft to 409 above the generic P0001 fallback", () => {
    expect(toOperationsApiError({ code: "P0001", message: "collection_not_cancelable_draft" })).toEqual({
      status: 409,
      code: "collection_not_cancelable_draft",
      message: "A coleta em rascunho não pode ser cancelada. Descarte o rascunho.",
      actorId: null,
    });
  });

  it("maps invoice and progress status guards after L2", () => {
    expect(toOperationsApiError({ code: "P0001", message: "collection_not_ready" })).toEqual({
      status: 409,
      code: "invoice_not_ready",
      message: "A coleta precisa estar pronta ou em entrega parcial para registrar a NF-e.",
      actorId: null,
    });
    expect(toOperationsApiError({ code: "P0001", message: "collection_not_in_service" })).toEqual({
      status: 409,
      code: "service_order_not_in_service",
      message: "A coleta precisa estar aprovada, em reparo, em entrega parcial ou faturada para atualizar o progresso.",
      actorId: null,
    });
  });

  it("maps invalid_signer_tax_id to 422 above the generic P0001 fallback", () => {
    expect(toOperationsApiError({ code: "P0001", message: "invalid_signer_tax_id" })).toEqual({
      status: 422,
      code: "invalid_signer_tax_id",
      message: "CPF ou CNPJ inválido, revise e tente novamente.",
      actorId: null,
    });
  });

  it("keeps collection_not_cancelable_draft distinct from collection_cannot_be_canceled", () => {
    const draft = toOperationsApiError({ code: "P0001", message: "collection_not_cancelable_draft" });
    const cannot = toOperationsApiError({ code: "P0001", message: "collection_cannot_be_canceled" });
    expect(draft).toEqual({
      status: 409,
      code: "collection_not_cancelable_draft",
      message: "A coleta em rascunho não pode ser cancelada. Descarte o rascunho.",
      actorId: null,
    });
    expect(cannot).toEqual({
      status: 409,
      code: "collection_cannot_be_canceled",
      message: "A coleta não pode ser cancelada no status atual.",
      actorId: null,
    });
    expect(draft.message).not.toBe(cannot.message);
  });

  it("maps service_order_reopen_status_unknown to 409 above the generic P0001 fallback", () => {
    expect(toOperationsApiError({ code: "P0001", message: "service_order_reopen_status_unknown" })).toEqual({
      status: 409,
      code: "service_order_reopen_status_unknown",
      message: "Não foi possível restaurar a ordem de serviço. A coleta permanece cancelada.",
      actorId: null,
    });
  });
});

