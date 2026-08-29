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
});
