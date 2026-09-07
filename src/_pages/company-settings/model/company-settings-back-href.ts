import type { Route } from "next";

const allowedBackHrefs = new Set<string>(["/dashboard", "/configuracoes"]);

export function companySettingsBackHref(from: string | null | undefined): Route {
  if (from !== undefined && from !== null && allowedBackHrefs.has(from)) {
    return from as Route;
  }
  return "/dashboard" as Route;
}
