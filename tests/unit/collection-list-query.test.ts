import { describe, expect, it } from "vitest";
import { collectionQuerySchema } from "@/_pages/collection-lifecycle/model/contracts";
import { buildCollectionsListHref, flattenSearchParams } from "@/_pages/collection-lifecycle/model/list-search";
import { statusesForListFilter } from "@/shared/model/collection-status";

describe("collection list query", () => {
  it("accepts q, filter and comma-separated statuses", () => {
    const parsed = collectionQuerySchema.parse({
      q: "  MJT-2026-000001  ",
      filter: "in_repair",
      statuses: "in_workshop,rejected",
      limit: 25,
    });

    expect(parsed.q).toBe("MJT-2026-000001");
    expect(parsed.filter).toBe("in_repair");
    expect(parsed.statuses).toEqual(["in_workshop", "rejected"]);
  });

  it("maps chips through statusesForListFilter", () => {
    expect(statusesForListFilter("ready")).toEqual(["ready", "invoiced", "partial_delivery"]);
    expect(statusesForListFilter("in_repair")).not.toContain("ready");
  });

  it("builds list href without cursor and omits empty q / all filter", () => {
    expect(buildCollectionsListHref("/coletas", { q: "  ", filter: "all" })).toBe("/coletas");
    expect(buildCollectionsListHref("/coletas", { q: "jose", filter: "in_repair" })).toBe(
      "/coletas?q=jose&filter=in_repair",
    );
  });

  it("flattens repeated statuses from searchParams", () => {
    expect(flattenSearchParams({ q: "ana", statuses: ["ready", "invoiced"] })).toEqual({
      q: "ana",
      statuses: "ready,invoiced",
    });
  });
});
