import { describe, expect, it } from "vitest";
import { operatorDisplayName, operatorGivenName } from "@/shared/auth/operator-display-name";

describe("operatorDisplayName", () => {
  it("uses the profile name when present", () => {
    expect(operatorDisplayName("João Marcelo Walk")).toBe("João Marcelo Walk");
  });

  it("does not substitute the account email when the profile name is empty", () => {
    expect(operatorDisplayName(null)).toBe("Coletor MJT");
    expect(operatorDisplayName("   ")).toBe("Coletor MJT");
  });
});

describe("operatorGivenName", () => {
  it("takes the first token of the profile name", () => {
    expect(operatorGivenName("João Marcelo Walk")).toBe("João");
  });

  it("falls back to Coletor, not an email local-part", () => {
    expect(operatorGivenName(null)).toBe("Coletor");
  });
});
