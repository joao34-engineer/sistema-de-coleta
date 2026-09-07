import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const jsdomUnitFiles = [
  "tests/unit/button-class-name.test.tsx",
  "tests/unit/dashboard-cta-links.test.tsx",
  "tests/unit/pending-nav-link.test.tsx",
  "tests/unit/collections-list-filter-chip.test.tsx",
  "tests/unit/use-hydrated.test.ts",
  "tests/unit/use-online-status.test.ts",
  "tests/unit/service-worker-registration.test.ts",
] as const;

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) },
  },
  test: {
    // Native addons (sharp, reachable from some unit tests via barrels) hang a
    // worker_thread on Windows; a child process loads them safely.
    pool: "forks",
    maxWorkers: 1,
    // `extends: true` makes each project reload this file so plugins/resolve inherit.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./tests/setup.node.ts"],
          include: [
            "tests/unit/**/*.test.ts",
            "tests/unit/**/*.test.tsx",
            "tests/phase-1/**/*.test.ts",
            "tests/phase-1/**/*.test.tsx",
          ],
          exclude: [...jsdomUnitFiles],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "tests/component/**/*.test.ts",
            "tests/component/**/*.test.tsx",
            ...jsdomUnitFiles,
          ],
        },
      },
    ],
  },
});
