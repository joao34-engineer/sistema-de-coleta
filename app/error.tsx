"use client";

import { RouteErrorFallback } from "@/_app/errors";

export default function Error({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <RouteErrorFallback error={error} reset={reset} />;
}
