import { describe, expect, it } from "vitest";
import { toSafeActionError } from "@/shared/lib/action-error";

describe("safe action errors", () => {
  it("maps known codes and never returns a raw database message", () => {
    expect(toSafeActionError(new Error("authentication_required"))).toEqual({
      ok: false,
      error: "Sessão expirada. Entre novamente para continuar.",
    });
    expect(toSafeActionError(new Error("column users.tax_id does not exist"))).toEqual({
      ok: false,
      error: "Não foi possível concluir a operação. Verifique a conexão e tente novamente.",
    });
    expect(JSON.stringify(toSafeActionError(new Error("cpf=52998224725")))).not.toContain("52998224725");
  });

  it("maps new workshop check-in business rule codes to Portuguese", () => {
    expect(toSafeActionError({ code: "P0001", message: "duplicate_workshop_item" })).toEqual({
      ok: false,
      error: "O mesmo item da coleta foi informado mais de uma vez no check-in.",
    });
    expect(toSafeActionError({ code: "P0001", message: "workshop_checkin_items_incomplete" })).toEqual({
      ok: false,
      error: "O check-in de oficina deve incluir todos os itens da coleta.",
    });
    expect(toSafeActionError(new Error("duplicate_workshop_item"))).toEqual({
      ok: false,
      error: "O mesmo item da coleta foi informado mais de uma vez no check-in.",
    });
    expect(toSafeActionError(new Error("workshop_checkin_items_incomplete"))).toEqual({
      ok: false,
      error: "O check-in de oficina deve incluir todos os itens da coleta.",
    });
  });

  it("maps delivery item validation codes to Portuguese", () => {
    expect(toSafeActionError({ code: "P0001", message: "duplicate_delivery_item" })).toEqual({
      ok: false,
      error: "O mesmo item foi informado mais de uma vez na entrega.",
    });
    expect(toSafeActionError({ code: "P0001", message: "item_already_delivered" })).toEqual({
      ok: false,
      error: "Um ou mais itens já foram entregues em um termo anterior.",
    });
    expect(toSafeActionError(new Error("duplicate_delivery_item"))).toEqual({
      ok: false,
      error: "O mesmo item foi informado mais de uma vez na entrega.",
    });
    expect(toSafeActionError(new Error("item_already_delivered"))).toEqual({
      ok: false,
      error: "Um ou mais itens já foram entregues em um termo anterior.",
    });
    expect(toSafeActionError(new Error("delivery_not_invoiced"))).toEqual({
      ok: false,
      error: "A coleta precisa estar pronta, faturada ou em entrega parcial para entregar ao cliente.",
    });
    expect(toSafeActionError({ code: "P0001", message: "collection_not_invoiced" })).toEqual({
      ok: false,
      error: "A coleta precisa estar pronta, faturada ou em entrega parcial para entregar ao cliente.",
    });
  });

  it("falls back to the generic P0001 message for unknown business rules", () => {
    expect(toSafeActionError({ code: "P0001", message: "some_unknown_detail" })).toEqual({
      ok: false,
      error: "A coleta não atende aos requisitos desta operação.",
    });
  });
});
