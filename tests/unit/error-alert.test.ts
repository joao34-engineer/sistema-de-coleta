import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetErrorAlertDedupeForTests, sendErrorAlert } from "@/shared/lib/error-alert.server";

describe("error alert webhook", () => {
  const originalEnv = process.env["ERROR_ALERT_WEBHOOK_URL"];

  beforeEach(() => {
    resetErrorAlertDedupeForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env["ERROR_ALERT_WEBHOOK_URL"];
    else process.env["ERROR_ALERT_WEBHOOK_URL"] = originalEnv;
    resetErrorAlertDedupeForTests();
  });

  it("is a no-op when the webhook URL is absent", async () => {
    delete process.env["ERROR_ALERT_WEBHOOK_URL"];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await sendErrorAlert({
      event: "transaction_failure",
      requestId: "req-absent",
      operation: "finalize_collection",
      code: "unexpected_error",
      status: 500,
      actor: null,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when the webhook URL is not https", async () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "http://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await sendErrorAlert({
      event: "transaction_failure",
      requestId: "req-http",
      operation: "finalize_collection",
      code: "unexpected_error",
      status: 500,
      actor: null,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not alert for status below 500", async () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "https://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await sendErrorAlert({
      event: "transaction_failure",
      requestId: "req-409",
      operation: "finalize_collection",
      code: "stale_version",
      status: 409,
      actor: null,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the allow-listed payload and fails open on network error", async () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "https://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network_down"));

    await expect(
      sendErrorAlert({
        event: "transaction_failure",
        requestId: "req-fail-open",
        operation: "finalize_collection",
        code: "unexpected_error",
        status: 500,
        actor: "abcdabcdabcdabcd",
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://hooks.example.invalid/alert");
    expect(init).toMatchObject({ method: "POST" });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    expect(body).toEqual({
      event: "transaction_failure",
      requestId: "req-fail-open",
      operation: "finalize_collection",
      code: "unexpected_error",
      status: 500,
      actor: "abcdabcdabcdabcd",
    });
  });

  it("dedupes by requestId within the same process", async () => {
    process.env["ERROR_ALERT_WEBHOOK_URL"] = "https://hooks.example.invalid/alert";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const payload = {
      event: "transaction_failure" as const,
      requestId: "req-dedupe",
      operation: "request_error",
      code: "unexpected_error",
      status: 500,
      actor: null,
    };

    await sendErrorAlert(payload);
    await sendErrorAlert(payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
