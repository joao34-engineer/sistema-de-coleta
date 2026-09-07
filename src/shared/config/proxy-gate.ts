import { isProtectedPath, routes } from "@/shared/config/routes";

export type ProxyGateDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: "/" | "/login" | "/dashboard" };

export function isProxyIdentityExemptPath(pathname: string): boolean {
  return pathname === "/api/health" || pathname === routes.signOut;
}

export function decideProxyGate(input: Readonly<{
  pathname: string;
  hasPublicEnv: boolean;
  publicEnvValid: boolean;
  hasIdentity: boolean | null;
}>): ProxyGateDecision {
  if (isProxyIdentityExemptPath(input.pathname)) return { action: "next" };
  if (!input.hasPublicEnv || !input.publicEnvValid) {
    return isProtectedPath(input.pathname)
      ? { action: "redirect", pathname: "/" }
      : { action: "next" };
  }
  if (input.hasIdentity === false && isProtectedPath(input.pathname)) {
    return { action: "redirect", pathname: "/login" };
  }
  if (input.hasIdentity === true && input.pathname === "/login") {
    return { action: "redirect", pathname: "/dashboard" };
  }
  return { action: "next" };
}
