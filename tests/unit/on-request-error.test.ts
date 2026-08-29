import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetErrorAlertDedupeForTests } from "@/shared/lib/error-alert.server";
import { onRequestError } from "../../instrumentation";

describe("onRequestError instrumentation", () => {
  const originalRuntime = process.env["NEXT_RUNTIME"];

  beforeEach(() => {
    resetErrorAlertDedupeForTests();
    delete process.env["ERROR_ALERT_WEBHOOK_URL"];
    delete process.env["NEXT_RUNTIME"];
  });

  afterEach(() => {
    if (originalRuntime === undefined) delete process.env["NEXT_RUNTIME"];
    else process.env["NEXT_RUNTIME"] = originalRuntime;
    resetErrorAlertDedupeForTests();
    vi.restoreAllMocks();
  });

  it("logs a safe operation from routePath and never includes the real path or token", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await onRequestError(
      new Error("secret_message_token_abc"),
      {
        path: "/d/super-secret-share-token-xyz",
        method: "GET",
        headers: { cookie: "sb-access-token=leak" },
      },
      {
        routerKind: "App Router",
        routePath: "/d/[token]",
        routeType: "render",
        revalidateReason: undefined,
      },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = consoleSpy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    if (typeof line !== "string") return;
    const parsed = JSON.parse(line) as Readonly<Record<string, unknown>>;
    expect(parsed["event"]).toBe("transaction_failure");
    expect(parsed["operation"]).toBe("request_error:/d/[token]");
    expect(parsed["code"]).toBe("unexpected_error");
    expect(parsed["status"]).toBe(500);
    expect(line).not.toContain("super-secret-share-token-xyz");
    expect(line).not.toContain("secret_message_token_abc");
    expect(line).not.toContain("sb-access-token");
    expect(line).not.toContain("/d/super-secret");
  });

  it("logs the allow-listed payload on Edge without importing node crypto paths", async () => {
    process.env["NEXT_RUNTIME"] = "edge";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await onRequestError(
      new Error("edge_secret"),
      { path: "/d/token-value", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/d/[token]",
        routeType: "render",
        revalidateReason: undefined,
      },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = consoleSpy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    if (typeof line !== "string") return;
    expect(line).toContain("request_error:/d/[token]");
    expect(line).not.toContain("token-value");
    expect(line).not.toContain("edge_secret");
  });
});
