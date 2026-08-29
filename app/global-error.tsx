"use client";

import { RouteErrorFallback } from "@/_app/errors";
import "@/_app/styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="pt-BR">
      <body>
        <RouteErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
