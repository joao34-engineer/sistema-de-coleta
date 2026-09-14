import { describe, expect, it } from "vitest";
import { maskRecipientEmail } from "@/_pages/collection-documents/model/mask-recipient-email";

describe("maskRecipientEmail", () => {
  it("keeps the first local character and the domain", () => {
    expect(maskRecipientEmail("ana@clinica.com")).toBe("a***@clinica.com");
  });

  it("leaves malformed values unchanged", () => {
    expect(maskRecipientEmail("sem-arroba")).toBe("sem-arroba");
    expect(maskRecipientEmail("@clinica.com")).toBe("@clinica.com");
  });
});
