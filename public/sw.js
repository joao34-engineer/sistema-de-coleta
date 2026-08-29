const SHELL_CACHE_NAME = "mjt-shell-v1";
const SHELL_CACHE_PREFIX = "mjt-shell-v";
const SKIP_WAITING_MESSAGE_TYPE = "SKIP_WAITING";
const SHELL_ASSET_PREFIXES = ["/_next/static/", "/icons/"];
const API_PATH_PREFIX = "/api/";
const SIGNED_SHARE_PATH_PREFIX = "/d/";
const VERIFICATION_PATH_PREFIX = "/verificar/";

self.addEventListener("install", () => {
  // Runtime CacheFirst populates the shell cache. Do not skipWaiting here:
  // the page must send SKIP_WAITING after the user confirms the update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(claimAndDropStaleShellCaches());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === SKIP_WAITING_MESSAGE_TYPE) {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (classifyShellRequest(event.request) !== "cache-first") {
    return;
  }

  event.respondWith(respondCacheFirst(event.request));
});

async function claimAndDropStaleShellCaches() {
  await self.clients.claim();
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((cacheName) => {
      if (cacheName.startsWith(SHELL_CACHE_PREFIX) && cacheName !== SHELL_CACHE_NAME) {
        return caches.delete(cacheName);
      }
      return undefined;
    }),
  );
}

function classifyShellRequest(request) {
  let parsedUrl;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    return "network-only";
  }

  if (request.method.toUpperCase() !== "GET") {
    return "network-only";
  }

  if (parsedUrl.origin !== self.location.origin) {
    return "network-only";
  }

  const pathname = parsedUrl.pathname;

  if (pathname.startsWith(API_PATH_PREFIX)) {
    return "network-only";
  }

  if (pathname.toLowerCase().endsWith(".pdf")) {
    return "network-only";
  }

  if (pathname.startsWith(SIGNED_SHARE_PATH_PREFIX)) {
    return "network-only";
  }

  if (pathname.startsWith(VERIFICATION_PATH_PREFIX)) {
    return "network-only";
  }

  if (request.destination === "document") {
    return "network-only";
  }

  const acceptHeader = request.headers.get("accept") || "";
  if (request.mode === "navigate" || acceptHeader.includes("text/html")) {
    return "network-only";
  }

  if (isShellAssetPathname(pathname)) {
    return "cache-first";
  }

  return "network-only";
}

function isShellAssetPathname(pathname) {
  return SHELL_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function respondCacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}
