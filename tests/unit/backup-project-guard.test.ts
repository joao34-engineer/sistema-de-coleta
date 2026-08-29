import { describe, expect, it } from "vitest";
import { assertRestoreTargetIsIsolated, projectRefFromUrl } from "../../scripts/backup/project-guard";

describe("backup project guard", () => {
  it("parses the project ref from the API URL", () => {
    expect(projectRefFromUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
  });

  it("refuses restore when target ref equals the MVP source ref", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        sourceProjectRef: "mvpprojectref00001",
        targetProjectRef: "mvpprojectref00001",
        targetUrl: "https://mvpprojectref00001.supabase.co",
      }),
    ).toThrow(/mesmo projeto/);
  });

  it("allows restore when target ref differs from the MVP", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        sourceProjectRef: "mvpprojectref00001",
        targetProjectRef: "throwawayref000002",
        targetUrl: "https://throwawayref000002.supabase.co",
      }),
    ).not.toThrow();
  });

  it("refuses when confirm ref does not match the target URL", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        sourceProjectRef: "mvpprojectref00001",
        targetProjectRef: "throwawayref000002",
        targetUrl: "https://otherprojectref0003.supabase.co",
      }),
    ).toThrow(/não coincide/);
  });
});
