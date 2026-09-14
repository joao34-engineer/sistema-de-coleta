import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});

afterEach(() => cleanup());

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});
