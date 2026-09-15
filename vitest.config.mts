import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const jsdomUnitFiles = [
  "tests/unit/button-class-name.test.tsx",
  "tests/unit/dashboard-cta-links.test.tsx",
  "tests/unit/pending-nav-link.test.tsx",
  "tests/unit/confirm-dialog.test.tsx",
  "tests/unit/collections-list-filter-chip.test.tsx",
  "tests/unit/use-hydrated.test.ts",
  "tests/unit/use-online-status.test.ts",
  "tests/unit/service-worker-registration.test.ts",
] as const;

/** Evaluates `pdf-image.server.ts` → real `sharp`. Must not run on worker_threads. */
const nativeAddonFiles = ["tests/unit/document-rendering.test.ts"] as const;

const serverOnly = fileURLToPath(new URL("./tests/server-only.ts", import.meta.url));
const sharpStub = fileURLToPath(new URL("./tests/stubs/sharp.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": serverOnly },
  },
  optimizeDeps: {
    exclude: ["sharp"],
  },
  ssr: {
    external: ["sharp"],
  },
  test: {
    fileParallelism: true,
    // `extends: true` makes each project reload this file so plugins/resolve inherit.
    projects: [
      {
        extends: true,
        resolve: {
          alias: { "server-only": serverOnly, sharp: sharpStub },
        },
        test: {
          name: "node",
          environment: "node",
          pool: "threads",
          setupFiles: ["./tests/setup.node.ts"],
          include: [
            "tests/unit/**/*.test.ts",
            "tests/unit/**/*.test.tsx",
            "tests/phase-1/**/*.test.ts",
            "tests/phase-1/**/*.test.tsx",
          ],
          exclude: [...jsdomUnitFiles, ...nativeAddonFiles],
        },
      },
      {
        extends: true,
        resolve: {
          alias: { "server-only": serverOnly, sharp: sharpStub },
        },
        test: {
          name: "dom",
          environment: "jsdom",
          pool: "threads",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "tests/component/**/*.test.ts",
            "tests/component/**/*.test.tsx",
            ...jsdomUnitFiles,
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "native",
          environment: "node",
          pool: "forks",
          setupFiles: ["./tests/setup.node.ts"],
          include: [...nativeAddonFiles],
        },
      },
    ],
  },
});
