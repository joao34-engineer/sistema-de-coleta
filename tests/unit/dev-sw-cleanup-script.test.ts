import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDevServiceWorkerCleanupScript } from "@/_app/pwa/model/dev-sw-cleanup-script";
import { DEV_SW_CLEARED_SESSION_KEY } from "@/_app/pwa/model/pwa-shell";
import { SHELL_CACHE_PREFIX } from "@/shared/lib/pwa/service-worker-protocol";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const layoutSource = readFileSync(join(repoRoot, "app", "layout.tsx"), "utf8");

describe("buildDevServiceWorkerCleanupScript", () => {
  it("unregisters workers, drops shell caches, and guards reload with the session key", () => {
    const script = buildDevServiceWorkerCleanupScript();

    expect(script).toContain("getRegistrations");
    expect(script).toContain("unregister");
    expect(script).toContain(SHELL_CACHE_PREFIX);
    expect(script).toContain(DEV_SW_CLEARED_SESSION_KEY);
    expect(script).toContain("location.reload");
    expect(script).toContain("caches.keys");
  });
});

describe("app/layout.tsx dev cleanup", () => {
  it("includes the inline cleanup script only outside production", () => {
    expect(layoutSource).toContain("buildDevServiceWorkerCleanupScript");
    expect(layoutSource).toContain('process.env.NODE_ENV !== "production"');
    expect(layoutSource).toContain("dangerouslySetInnerHTML");
  });
});
