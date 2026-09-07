import { describe, expect, it } from "vitest";
import { decideProxyGate, type ProxyGateDecision } from "@/shared/config/proxy-gate";

const allowedRedirectDestinations = ["/", "/login", "/dashboard"] as const;

function redirectDestination(decision: ProxyGateDecision): string | undefined {
  return decision.action === "redirect" ? decision.pathname : undefined;
}

describe("decideProxyGate", () => {
  it("passes /api/health through without env or identity", () => {
    expect(
      decideProxyGate({
        pathname: "/api/health",
        hasPublicEnv: false,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "next" });
  });

  it("passes POST /api/auth/sign-out through without env or identity", () => {
    expect(
      decideProxyGate({
        pathname: "/api/auth/sign-out",
        hasPublicEnv: false,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "next" });
  });

  it("does not bounce an authenticated POST /api/auth/sign-out to the dashboard", () => {
    expect(
      decideProxyGate({
        pathname: "/api/auth/sign-out",
        hasPublicEnv: true,
        publicEnvValid: true,
        hasIdentity: true,
      }),
    ).toEqual({ action: "next" });
  });

  it("redirects protected HTML to / when public env is missing", () => {
    expect(
      decideProxyGate({
        pathname: "/dashboard",
        hasPublicEnv: false,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "redirect", pathname: "/" });
  });

  it("allows public HTML when public env is missing", () => {
    expect(
      decideProxyGate({
        pathname: "/login",
        hasPublicEnv: false,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "next" });
  });

  it("redirects protected HTML to / when public env is present but invalid", () => {
    expect(
      decideProxyGate({
        pathname: "/coletas/abc/oficina",
        hasPublicEnv: true,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "redirect", pathname: "/" });
  });

  it("allows public HTML when public env is present but invalid", () => {
    expect(
      decideProxyGate({
        pathname: "/d/share-token",
        hasPublicEnv: true,
        publicEnvValid: false,
        hasIdentity: null,
      }),
    ).toEqual({ action: "next" });
  });

  it("redirects unauthenticated protected requests to /login when env is valid", () => {
    expect(
      decideProxyGate({
        pathname: "/configuracoes/empresa",
        hasPublicEnv: true,
        publicEnvValid: true,
        hasIdentity: false,
      }),
    ).toEqual({ action: "redirect", pathname: "/login" });
  });

  it("redirects authenticated /login to /dashboard when env is valid", () => {
    expect(
      decideProxyGate({
        pathname: "/login",
        hasPublicEnv: true,
        publicEnvValid: true,
        hasIdentity: true,
      }),
    ).toEqual({ action: "redirect", pathname: "/dashboard" });
  });

  it("allows authenticated protected requests when env is valid", () => {
    expect(
      decideProxyGate({
        pathname: "/dashboard",
        hasPublicEnv: true,
        publicEnvValid: true,
        hasIdentity: true,
      }),
    ).toEqual({ action: "next" });
  });

  it("allows unauthenticated public requests when env is valid", () => {
    expect(
      decideProxyGate({
        pathname: "/verificar/token",
        hasPublicEnv: true,
        publicEnvValid: true,
        hasIdentity: false,
      }),
    ).toEqual({ action: "next" });
  });

  it("only redirects to /, /login, or /dashboard", () => {
    const scenarios = [
      { pathname: "/api/health", hasPublicEnv: false, publicEnvValid: false, hasIdentity: null },
      { pathname: "/api/auth/sign-out", hasPublicEnv: true, publicEnvValid: true, hasIdentity: true },
      { pathname: "/dashboard", hasPublicEnv: false, publicEnvValid: false, hasIdentity: null },
      { pathname: "/login", hasPublicEnv: false, publicEnvValid: false, hasIdentity: null },
      { pathname: "/coletas/x", hasPublicEnv: true, publicEnvValid: false, hasIdentity: null },
      { pathname: "/", hasPublicEnv: true, publicEnvValid: false, hasIdentity: null },
      { pathname: "/configuracoes", hasPublicEnv: true, publicEnvValid: true, hasIdentity: false },
      { pathname: "/login", hasPublicEnv: true, publicEnvValid: true, hasIdentity: true },
      { pathname: "/dashboard", hasPublicEnv: true, publicEnvValid: true, hasIdentity: true },
      { pathname: "/d/x", hasPublicEnv: true, publicEnvValid: true, hasIdentity: false },
    ] as const;

    for (const scenario of scenarios) {
      const destination = redirectDestination(decideProxyGate(scenario));
      if (destination !== undefined) {
        expect(allowedRedirectDestinations).toContain(destination);
      }
    }
  });
});
