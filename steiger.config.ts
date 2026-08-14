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
      "fsd/no-public-api-sidestep": "off",
    },
  },
]);

export default steigerConfig;
