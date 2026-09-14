import { describe, expect, it } from "vitest";
import { toOfflineExistingCustomer } from "@/_pages/collection-drafts/model/wizard-draft-props";

const customerId = "44444444-4444-4444-8444-444444444444";

describe("toOfflineExistingCustomer", () => {
  it("maps a valid customer identity for hydrate", () => {
    const customer = toOfflineExistingCustomer({
      customerId,
      displayName: "Oficina Norte",
      taxId: "52998224725",
      phone: "11998765432",
      street: "Rua Augusta",
      city: "Campinas",
      stateCode: "sp",
    });
    expect(customer).toEqual({
      mode: "existing",
      customerId,
      displayName: "Oficina Norte",
      taxId: "52998224725",
      phone: "11998765432",
      street: "Rua Augusta",
      city: "Campinas",
      stateCode: "SP",
    });
  });

  it("rejects a placeholder CPF", () => {
    expect(
      toOfflineExistingCustomer({
        customerId,
        displayName: "Oficina Norte",
        taxId: "00000000000",
        phone: "11998765432",
      }),
    ).toBeNull();
  });

  it("rejects a short phone", () => {
    expect(
      toOfflineExistingCustomer({
        customerId,
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "123",
      }),
    ).toBeNull();
  });
});
