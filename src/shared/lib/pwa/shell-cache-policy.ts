export type ShellRequestClassificationInput = {
  readonly method: string;
  readonly url: string;
  readonly destination: string;
  readonly mode: string;
  readonly acceptHeader: string;
  readonly clientOrigin: string;
};

export type ShellNetworkOnlyReason =
  | "invalid-url"
  | "method-not-get"
  | "cross-origin"
  | "api"
  | "pdf"
  | "signed-share"
  | "verification"
  | "html-document"
  | "document-download"
  | "not-shell-asset";

export type ShellRequestClassification =
  | { readonly kind: "cache-first" }
  | { readonly kind: "network-only"; readonly reason: ShellNetworkOnlyReason };

const SHELL_ASSET_PREFIXES = ["/_next/static/", "/icons/"] as const;
const API_PATH_PREFIX = "/api/";
const SIGNED_SHARE_PATH_PREFIX = "/d/";
const VERIFICATION_PATH_PREFIX = "/verificar/";

export function classifyShellRequest(
  request: ShellRequestClassificationInput,
): ShellRequestClassification {
  const parsedUrl = parseAbsoluteUrl(request.url);
  if (parsedUrl === null) {
    return networkOnly("invalid-url");
  }

  if (request.method.toUpperCase() !== "GET") {
    return networkOnly("method-not-get");
  }

  if (parsedUrl.origin !== request.clientOrigin) {
    return networkOnly("cross-origin");
  }

  const pathname = parsedUrl.pathname;

  if (pathname.startsWith(API_PATH_PREFIX)) {
    return networkOnly("api");
  }

  if (pathname.toLowerCase().endsWith(".pdf")) {
    return networkOnly("pdf");
  }

  if (pathname.startsWith(SIGNED_SHARE_PATH_PREFIX)) {
    return networkOnly("signed-share");
  }

  if (pathname.startsWith(VERIFICATION_PATH_PREFIX)) {
    return networkOnly("verification");
  }

  if (request.destination === "document") {
    return networkOnly("html-document");
  }

  if (isDocumentDownload(request)) {
    return networkOnly("document-download");
  }

  if (isShellAssetPathname(pathname)) {
    return { kind: "cache-first" };
  }

  return networkOnly("not-shell-asset");
}

function networkOnly(reason: ShellNetworkOnlyReason): ShellRequestClassification {
  return { kind: "network-only", reason };
}

function parseAbsoluteUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isDocumentDownload(request: ShellRequestClassificationInput): boolean {
  return request.mode === "navigate" || request.acceptHeader.includes("text/html");
}

function isShellAssetPathname(pathname: string): boolean {
  return SHELL_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
