import { describe, expect, it } from "vitest";
import { hubChrome, leafChrome } from "@/_pages/company-settings/model/settings-chrome";

describe("settings chrome copy", () => {
  it("keeps Figma CFG01 on the hub", () => {
    expect(hubChrome).toEqual({
      title: "Conta",
      subtitle: "Configurações da conta",
    });
  });

  it("keeps Figma M11 on the issuer leaf", () => {
    expect(leafChrome).toEqual({
      title: "Empresa",
      subtitle: "Dados institucionais",
    });
  });

  it("does not reuse the same title or subtitle on hub and leaf", () => {
    expect(hubChrome.title).not.toBe(leafChrome.title);
    expect(hubChrome.subtitle).not.toBe(leafChrome.subtitle);
  });
});
