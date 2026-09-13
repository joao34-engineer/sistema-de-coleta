import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

const steigerConfig = defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/shared/**"],
    rules: { "fsd/public-api": "off", "fsd/no-public-api-sidestep": "off" },
  },
  {
    files: ["./src/_app/**", "./src/_pages/**"],
    rules: {
      "fsd/typo-in-layer-name": "off",
      "fsd/no-segmentless-slices": "off",
    },
  },
  {
    files: [
      "./src/_pages/collection-operations/api/load-operation.ts",
      "./src/_pages/collection-operations/ui/collection-detail-hub-route.tsx",
    ],
    rules: {
      // Hub/oficina compose lifecycle detail + ops queries. Fase H / entities/collection would remove this.
      "fsd/forbidden-imports": "off",
    },
  },
]);

export default steigerConfig;
