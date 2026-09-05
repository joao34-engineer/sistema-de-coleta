import { afterEach, describe, expect, it } from "vitest";
import { isWorkerRequestAuthorized } from "@/_pages/collection-documents/api/delivery/worker.server";

const WORKER_SECRET = "w".repeat(32);
const CRON_SECRET = "c".repeat(32);

describe("document worker authorization", () => {
  const previousWorker = process.env["DOCUMENT_WORKER_SECRET"];
  const previousCron = process.env["CRON_SECRET"];

  afterEach(() => {
    if (previousWorker === undefined) delete process.env["DOCUMENT_WORKER_SECRET"];
    else process.env["DOCUMENT_WORKER_SECRET"] = previousWorker;
    if (previousCron === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = previousCron;
  });

  it("rejects requests without credentials (403 path)", () => {
    process.env["DOCUMENT_WORKER_SECRET"] = WORKER_SECRET;
    process.env["CRON_SECRET"] = CRON_SECRET;
    expect(isWorkerRequestAuthorized(new Request("https://example.com/api/internal/document-jobs/run"))).toBe(false);
  });

  it("rejects wrong worker secret", () => {
    process.env["DOCUMENT_WORKER_SECRET"] = WORKER_SECRET;
    delete process.env["CRON_SECRET"];
    const request = new Request("https://example.com/api/internal/document-jobs/run", {
      headers: { "X-Document-Worker-Secret": "x".repeat(32) },
    });
    expect(isWorkerRequestAuthorized(request)).toBe(false);
  });

  it("accepts X-Document-Worker-Secret for manual curl", () => {
    process.env["DOCUMENT_WORKER_SECRET"] = WORKER_SECRET;
    delete process.env["CRON_SECRET"];
    const request = new Request("https://example.com/api/internal/document-jobs/run", {
      headers: { "X-Document-Worker-Secret": WORKER_SECRET },
    });
    expect(isWorkerRequestAuthorized(request)).toBe(true);
  });

  it("accepts Authorization Bearer CRON_SECRET for Vercel cron GET", () => {
    delete process.env["DOCUMENT_WORKER_SECRET"];
    process.env["CRON_SECRET"] = CRON_SECRET;
    const request = new Request("https://example.com/api/internal/document-jobs/run", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(isWorkerRequestAuthorized(request)).toBe(true);
  });

  it("rejects short secrets", () => {
    process.env["DOCUMENT_WORKER_SECRET"] = "short";
    process.env["CRON_SECRET"] = "also-short";
    const workerRequest = new Request("https://example.com/", {
      headers: { "X-Document-Worker-Secret": "short" },
    });
    const cronRequest = new Request("https://example.com/", {
      headers: { Authorization: "Bearer also-short" },
    });
    expect(isWorkerRequestAuthorized(workerRequest)).toBe(false);
    expect(isWorkerRequestAuthorized(cronRequest)).toBe(false);
  });
});
