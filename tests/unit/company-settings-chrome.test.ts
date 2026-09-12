import { describe, expect, it } from "vitest";
import { hubChrome, leafChrome } from "@/_pages/company-settings/model/settings-chrome";

describe("settings chrome copy", () => {
  it("keeps Figma M11 on the hub", () => {
    expect(hubChrome).toEqual({
      title: "Empresa",
      subtitle: "Dados institucionais",
    });
  });

  it("names the issuer leaf as a distinct page", () => {
    expect(leafChrome).toEqual({
      title: "Perfil institucional",
      subtitle: "Razão social, CNPJ e rodapé da guia",
    });
  });

  it("does not reuse the same title or subtitle on hub and leaf", () => {
    expect(hubChrome.title).not.toBe(leafChrome.title);
    expect(hubChrome.subtitle).not.toBe(leafChrome.subtitle);
  });
});
