import { describe, expect, it } from "vitest";
import { companySettingsBackHref } from "@/_pages/company-settings/model/company-settings-back-href";

describe("companySettingsBackHref", () => {
  it("defaults to the dashboard", () => {
    expect(companySettingsBackHref(undefined)).toBe("/dashboard");
    expect(companySettingsBackHref(null)).toBe("/dashboard");
  });

  it("allows the settings hub", () => {
    expect(companySettingsBackHref("/configuracoes")).toBe("/configuracoes");
  });

  it("rejects an unknown from value", () => {
    expect(companySettingsBackHref("/coletas")).toBe("/dashboard");
    expect(companySettingsBackHref("https://evil.example")).toBe("/dashboard");
  });
});
