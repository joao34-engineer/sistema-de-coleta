import { describe, expect, it } from "vitest";
import {
  classifyShellRequest,
  type ShellRequestClassificationInput,
} from "@/shared/lib/pwa/shell-cache-policy";

const ORIGIN = "https://coleta.mjt.local";

function input(
  pathname: string,
  overrides: {
    readonly method?: string;
    readonly destination?: string;
    readonly mode?: string;
    readonly acceptHeader?: string;
    readonly origin?: string;
    readonly clientOrigin?: string;
  } = {},
): ShellRequestClassificationInput {
  const origin = overrides.origin ?? ORIGIN;
  return {
    method: overrides.method ?? "GET",
    url: `${origin}${pathname}`,
    destination: overrides.destination ?? "script",
    mode: overrides.mode ?? "cors",
    acceptHeader: overrides.acceptHeader ?? "*/*",
    clientOrigin: overrides.clientOrigin ?? ORIGIN,
  };
}

describe("classifyShellRequest", () => {
  it("uses cache-first for Next static chunks", () => {
    expect(classifyShellRequest(input("/_next/static/chunk.js"))).toEqual({ kind: "cache-first" });
  });

  it("uses cache-first for PWA icons", () => {
    expect(classifyShellRequest(input("/icons/icon-192.png", { destination: "image" }))).toEqual({
      kind: "cache-first",
    });
  });

  it("keeps API requests on the network", () => {
    expect(classifyShellRequest(input("/api/collections"))).toEqual({
      kind: "network-only",
      reason: "api",
    });
  });

  it("keeps PDF downloads on the network", () => {
    expect(classifyShellRequest(input("/guias/coleta.pdf"))).toEqual({
      kind: "network-only",
      reason: "pdf",
    });
  });

  it("keeps signed share links on the network", () => {
    expect(classifyShellRequest(input("/d/token"))).toEqual({
      kind: "network-only",
      reason: "signed-share",
    });
  });

  it("keeps HTML documents on the network", () => {
    expect(classifyShellRequest(input("/", { destination: "document" }))).toEqual({
      kind: "network-only",
      reason: "html-document",
    });
  });

  it("keeps cross-origin requests on the network", () => {
    expect(classifyShellRequest(input("/_next/static/chunk.js", { origin: "https://cdn.example" }))).toEqual({
      kind: "network-only",
      reason: "cross-origin",
    });
  });

  it("keeps non-GET requests on the network", () => {
    expect(classifyShellRequest(input("/_next/static/chunk.js", { method: "POST" }))).toEqual({
      kind: "network-only",
      reason: "method-not-get",
    });
  });
});
