import { describe, expect, it } from "vitest";
import { listRowStatusLabel, listRowStatusTone } from "@/_pages/collection-lifecycle/model/list-row-status";

describe("listRowStatusLabel", () => {
  it("uses Pronto on the row while the chip stays Pronta", () => {
    expect(listRowStatusLabel("ready")).toBe("Pronto");
  });

  it("keeps the canonical label for other statuses", () => {
    expect(listRowStatusLabel("collected")).toBe("Coletada");
    expect(listRowStatusLabel("draft")).toBe("Rascunho");
    expect(listRowStatusLabel("in_service")).toBe("Em reparo");
  });
});

describe("listRowStatusTone", () => {
  it("marks collected and ready as brand", () => {
    expect(listRowStatusTone("collected")).toBe("brand");
    expect(listRowStatusTone("ready")).toBe("brand");
  });

  it("marks workshop statuses as warning and drafts as muted", () => {
    expect(listRowStatusTone("in_service")).toBe("warning");
    expect(listRowStatusTone("draft")).toBe("muted");
    expect(listRowStatusTone("canceled")).toBe("muted");
  });
});
