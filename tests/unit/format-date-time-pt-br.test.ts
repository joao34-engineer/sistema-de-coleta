import { describe, expect, it } from "vitest";
import { formatDateTimePtBr } from "@/shared/lib/format-date-time-pt-br";

describe("formatDateTimePtBr", () => {
  it("formats an ISO instant with a stable pt-BR pattern in Sao Paulo", () => {
    expect(formatDateTimePtBr("2026-09-05T03:45:00.000Z")).toBe("05/09/2026, 00:45");
  });

  it("returns the original value when the instant is invalid", () => {
    expect(formatDateTimePtBr("not-a-date")).toBe("not-a-date");
  });
});
