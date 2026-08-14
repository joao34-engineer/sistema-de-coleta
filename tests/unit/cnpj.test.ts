import { describe, expect, it } from "vitest";
import { isValidCnpj, normalizeDigits } from "@/shared/lib/cnpj";

describe("CNPJ", () => {
  it("normalizes punctuation", () => expect(normalizeDigits("04.252.011/0001-10")).toBe("04252011000110"));
  it("validates a known valid CNPJ", () => expect(isValidCnpj("04.252.011/0001-10")).toBe(true));
  it("rejects repeated digits and invalid checksums", () => { expect(isValidCnpj("11.111.111/1111-11")).toBe(false); expect(isValidCnpj("04.252.011/0001-11")).toBe(false); });
});
