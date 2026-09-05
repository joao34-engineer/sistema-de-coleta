import { describe, expect, it } from "vitest";
import { cadastralAddressForSync, isIncompleteCadastral } from "@/_pages/collection-drafts/model/cadastral-address-for-sync";

describe("cadastralAddressForSync", () => {
  it("omits address when only street is present", () => {
    expect(cadastralAddressForSync({ street: "Rua Augusta", city: null, stateCode: null })).toBeNull();
    expect(cadastralAddressForSync({ street: "Rua Augusta", city: "São Paulo", stateCode: null })).toBeNull();
  });

  it("returns the triad when street, city and UF are complete", () => {
    expect(cadastralAddressForSync({ street: " Rua Augusta ", city: " Campinas ", stateCode: "sp" })).toEqual({
      street: "Rua Augusta",
      city: "Campinas",
      stateCode: "SP",
    });
  });

  it("treats a partial cadastral as incomplete", () => {
    expect(isIncompleteCadastral({ street: "Rua Augusta", city: "", stateCode: "" })).toBe(true);
    expect(isIncompleteCadastral({ street: "", city: "", stateCode: "" })).toBe(false);
    expect(isIncompleteCadastral({ street: "Rua Augusta", city: "Campinas", stateCode: "SP" })).toBe(false);
  });
});
