import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetErrorAlertDedupeForTests } from "@/shared/lib/error-alert.server";
import { actorIdFromUnknown, attachActorId, getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";

describe("transaction failure logger", () => {
  const originalEnv = process.env["ERROR_ALERT_WEBHOOK_URL"];

  beforeEach(() => {
    resetErrorAlertDedupeForTests();
    delete process.env["ERROR_ALERT_WEBHOOK_URL"];
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env["ERROR_ALERT_WEBHOOK_URL"];
    else process.env["ERROR_ALERT_WEBHOOK_URL"] = originalEnv;
    resetErrorAlertDedupeForTests();
    vi.restoreAllMocks();
  });

  it("keeps only the allow-listed fields and pseudonymizes the actor", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logTransactionFailure({
      requestId: "qa-request-123",
      operation: "finalize_collection",
      code: "stale_version",
      actorId: "00000000-0000-0000-0000-000000000001",
      status: 409,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const firstCall = consoleSpy.mock.calls[0];
    const line = firstCall?.[0];
    expect(typeof line).toBe("string");
    if (typeof line !== "string") return;
    const parsed = JSON.parse(line) as Readonly<Record<string, unknown>>;
    expect(Object.keys(parsed).sort()).toEqual(["actor", "code", "event", "operation", "requestId", "status"]);
    expect(parsed["event"]).toBe("transaction_failure");
    expect(parsed["requestId"]).toBe("qa-request-123");
    expect(parsed["operation"]).toBe("finalize_collection");
    expect(parsed["code"]).toBe("stale_version");
    expect(parsed["status"]).toBe(409);
    expect(parsed["actor"]).toMatch(/^[0-9a-f]{16}$/);
    expect(line).not.toContain("00000000-0000-0000-0000-000000000001");
    expect(line).not.toContain("52998224725");
  });

  it("does not call the webhook for status below 500", () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "https://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logTransactionFailure({
      requestId: "qa-request-409",
      operation: "finalize_collection",
      code: "stale_version",
      actorId: null,
      status: 409,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fires the webhook once for status 500 with a single console.error", async () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "https://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logTransactionFailure({
      requestId: "qa-request-500",
      operation: "finalize_collection",
      code: "unexpected_error",
      actorId: null,
      status: 500,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });

  it("attaches a non-enumerable actor id without putting it in JSON", () => {
    const error = new Error("unexpected_error");
    const tagged = attachActorId(error, "00000000-0000-0000-0000-000000000001");
    expect(actorIdFromUnknown(tagged)).toBe("00000000-0000-0000-0000-000000000001");
    expect(JSON.stringify(tagged)).not.toContain("00000000-0000-0000-0000-000000000001");
  });

  it("replaces malformed request ids with a generated safe id", () => {
    const request = new Request("https://qa.invalid", { headers: { "x-request-id": "cpf=52998224725" } });
    const requestId = getRequestId(request);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes a valid SQLSTATE in the allow-listed payload", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logTransactionFailure({
      requestId: "qa-request-sqlstate",
      operation: "publish_company_issuer_profile",
      code: "issuer_publish_failed",
      actorId: null,
      status: 500,
      databaseCode: "42702",
    });
    const line = consoleSpy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    if (typeof line !== "string") return;
    const parsed = JSON.parse(line) as Readonly<Record<string, unknown>>;
    expect(parsed["databaseCode"]).toBe("42702");
  });

  it("omits malformed database codes from the payload", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logTransactionFailure({
      requestId: "qa-request-bad-code",
      operation: "publish_company_issuer_profile",
      code: "issuer_publish_failed",
      actorId: null,
      status: 500,
      databaseCode: "ambiguous column reference",
    });
    const line = consoleSpy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    if (typeof line !== "string") return;
    const parsed = JSON.parse(line) as Readonly<Record<string, unknown>>;
    expect(Object.keys(parsed).sort()).toEqual(["actor", "code", "event", "operation", "requestId", "status"]);
  });
});
