import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SERVICE_WORKER_URL,
  SHELL_CACHE_NAME,
  SKIP_WAITING_MESSAGE_TYPE,
} from "@/shared/lib/pwa/service-worker-protocol";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const swSource = readFileSync(join(repoRoot, "public", SERVICE_WORKER_URL.replace(/^\//, "")), "utf8");

function listenerSource(eventName: string): string {
  const marker = `addEventListener("${eventName}"`;
  const start = swSource.indexOf(marker);
  expect(start, `missing ${eventName} listener`).toBeGreaterThanOrEqual(0);

  const next = swSource.indexOf("addEventListener(", start + marker.length);
  return next >= 0 ? swSource.slice(start, next) : swSource.slice(start);
}

describe("public/sw.js contract", () => {
  it("binds shell cache, API, PDF and skip-waiting literals", () => {
    expect(swSource).toContain(SHELL_CACHE_NAME);
    expect(swSource).toContain(SKIP_WAITING_MESSAGE_TYPE);
    expect(swSource).toContain("/api/");
    expect(swSource).toContain(".pdf");
  });

  it("does not call skipWaiting during install", () => {
    const installListener = listenerSource("install");
    expect(installListener).not.toMatch(/skipWaiting\s*\(/);
  });

  it("may skip waiting after a confirmed message", () => {
    expect(listenerSource("message")).toMatch(/skipWaiting\s*\(/);
  });
});
