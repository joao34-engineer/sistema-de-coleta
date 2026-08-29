/**
 * Logs unexpected request failures without leaking share/verification tokens.
 * Never pass path, query, headers, or error.message into the logger payload.
 * Edge must not import server-logger (node:crypto); Node gets the full logger + webhook.
 */
export async function onRequestError(
  error: unknown,
  _request: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  context: Readonly<{
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "proxy";
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
    revalidateReason: "on-demand" | "stale" | undefined;
  }>,
): Promise<void> {
  void error;
  const routePath =
    typeof context.routePath === "string" && context.routePath.length > 0 && !context.routePath.includes("?")
      ? context.routePath
      : "request_error";
  const operation = routePath === "request_error" ? "request_error" : `request_error:${routePath}`;

  if (process.env["NEXT_RUNTIME"] === "edge") {
    try {
      console.error(
        JSON.stringify({
          event: "transaction_failure",
          requestId: crypto.randomUUID(),
          operation,
          code: "unexpected_error",
          status: 500,
          actor: null,
        }),
      );
    } catch {
      // Logging is best-effort.
    }
    return;
  }

  const { getRequestId, logTransactionFailure } = await import("@/shared/lib/server-logger");
  logTransactionFailure({
    requestId: getRequestId(),
    operation,
    code: "unexpected_error",
    actorId: null,
    status: 500,
  });
}
