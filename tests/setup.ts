import { webcrypto } from "node:crypto";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createElement, lazy, Suspense, type ComponentType } from "react";

configure({ asyncUtilTimeout: 5000 });

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
    options?: { loading?: ComponentType },
  ) => {
    const Lazy = lazy(loader);
    function DynamicMock(props: Record<string, unknown>) {
      const fallback = options?.loading ? createElement(options.loading) : null;
      return createElement(Suspense, { fallback }, createElement(Lazy, props));
    }
    return DynamicMock;
  },
}));

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});

afterEach(() => cleanup());
