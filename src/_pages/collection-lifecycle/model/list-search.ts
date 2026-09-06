import type { Route } from "next";
import type { CollectionsListFilter } from "@/shared/model/collection-status";

export function flattenSearchParams(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      result[key] = value;
      continue;
    }
    if (!Array.isArray(value) || value.length === 0) continue;
    result[key] = key === "statuses" ? value.join(",") : (value[0] ?? "");
  }
  return result;
}

export function buildCollectionsListHref(
  pathname: string,
  input: Readonly<{ q: string; filter: CollectionsListFilter }>,
): Route {
  const params = new URLSearchParams();
  const q = input.q.trim();
  if (q.length > 0) params.set("q", q);
  if (input.filter !== "all") params.set("filter", input.filter);
  const query = params.toString();
  return (query.length > 0 ? `${pathname}?${query}` : pathname) as Route;
}
