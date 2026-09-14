import { createElement, lazy, Suspense, type ComponentType } from "react";

export function nextDynamicMock(
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
  options?: { loading?: ComponentType },
) {
  const Lazy = lazy(loader);
  function DynamicMock(props: Record<string, unknown>) {
    const fallback = options?.loading ? createElement(options.loading) : null;
    return createElement(Suspense, { fallback }, createElement(Lazy, props));
  }
  return DynamicMock;
}
