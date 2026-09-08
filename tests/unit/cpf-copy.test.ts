import { describe, expect, it } from "vitest";
import {
  INVALID_SIGNER_TAX_ID_COPY,
  invalidCpfOrCnpjMessage,
  isValidCpfOrCnpj,
} from "@/shared/lib/cpf";

describe("invalidCpfOrCnpjMessage", () => {
  it("splits CPF and CNPJ copy by digit length", () => {
    expect(invalidCpfOrCnpjMessage("11111111111")).toBe("CPF inválido, revise e tente novamente.");
    expect(invalidCpfOrCnpjMessage("04252011000111")).toBe("CNPJ inválido, revise e tente novamente.");
    expect(invalidCpfOrCnpjMessage("123")).toBe("Informe um CPF ou CNPJ válido.");
  });

  it("keeps the queue/API copy generic when length is unknown", () => {
    expect(INVALID_SIGNER_TAX_ID_COPY).toMatch(/CPF ou CNPJ inválido/i);
    expect(isValidCpfOrCnpj("52998224725")).toBe(true);
    expect(isValidCpfOrCnpj("11111111111")).toBe(false);
  });
});
