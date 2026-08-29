export const routes = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  companySettings: "/configuracoes/empresa",
} as const;

export const protectedRoutePrefixes = [routes.dashboard, "/configuracoes", "/coletas"] as const;
