import { describe, expect, it, vi } from "vitest";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";

describe("transaction failure logger", () => {
  it("keeps only the allow-listed fields and pseudonymizes the actor", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
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
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("replaces malformed request ids with a generated safe id", () => {
    const request = new Request("https://qa.invalid", { headers: { "x-request-id": "cpf=52998224725" } });
    const requestId = getRequestId(request);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

