import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SERVICE_WORKER_REGISTRATION_OPTIONS,
  dropShellCaches,
  registerColetaServiceWorker,
  unregisterColetaServiceWorkers,
} from "@/_app/pwa/model/service-worker-registration";
import { SERVICE_WORKER_URL } from "@/shared/lib/pwa/service-worker-protocol";

type MockRegistration = {
  readonly unregister: ReturnType<typeof vi.fn>;
};

function createMockRegistration(): MockRegistration {
  return {
    unregister: vi.fn().mockResolvedValue(true),
  };
}

function stubServiceWorker(options: {
  readonly register?: ReturnType<typeof vi.fn>;
  readonly getRegistrations?: ReturnType<typeof vi.fn>;
  readonly controller?: ServiceWorker | null;
} = {}): void {
  const register = options.register ?? vi.fn();
  const getRegistrations = options.getRegistrations ?? vi.fn().mockResolvedValue([]);
  const controller = options.controller ?? null;

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register,
      getRegistrations,
      controller,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

function stubCaches(options: {
  readonly keys?: ReturnType<typeof vi.fn>;
  readonly delete?: ReturnType<typeof vi.fn>;
} = {}): void {
  const keys = options.keys ?? vi.fn().mockResolvedValue([]);
  const del = options.delete ?? vi.fn().mockResolvedValue(true);

  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      keys,
      delete: del,
    },
  });
}

describe("unregisterColetaServiceWorkers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("unregisters every existing registration", async () => {
    const first = createMockRegistration();
    const second = createMockRegistration();
    stubServiceWorker({
      getRegistrations: vi.fn().mockResolvedValue([first, second]),
    });

    await unregisterColetaServiceWorkers();

    expect(first.unregister).toHaveBeenCalledOnce();
    expect(second.unregister).toHaveBeenCalledOnce();
  });
});

describe("dropShellCaches", () => {
  it("deletes shell caches and keeps unrelated names", async () => {
    const del = vi.fn().mockResolvedValue(true);
    stubCaches({
      keys: vi.fn().mockResolvedValue(["mjt-shell-v1", "mjt-shell-v2", "other-cache"]),
      delete: del,
    });

    await dropShellCaches();

    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("mjt-shell-v1");
    expect(del).toHaveBeenCalledWith("mjt-shell-v2");
    expect(del).not.toHaveBeenCalledWith("other-cache");
  });
});

describe("registerColetaServiceWorker", () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalServiceWorker,
    });
    Reflect.deleteProperty(globalThis, "caches");
  });

  it("does not register in development and clears leftover workers and shell caches", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const first = createMockRegistration();
    const register = vi.fn();
    const del = vi.fn().mockResolvedValue(true);
    stubServiceWorker({
      register,
      getRegistrations: vi.fn().mockResolvedValue([first]),
    });
    stubCaches({
      keys: vi.fn().mockResolvedValue(["mjt-shell-v1", "mjt-shell-v2", "other-cache"]),
      delete: del,
    });

    const result = await registerColetaServiceWorker();

    expect(result).toBeNull();
    expect(register).not.toHaveBeenCalled();
    expect(first.unregister).toHaveBeenCalledOnce();
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("mjt-shell-v1");
    expect(del).toHaveBeenCalledWith("mjt-shell-v2");
    expect(del).not.toHaveBeenCalledWith("other-cache");
  });

  it("registers the production worker with the ADR options", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const registration = { scope: "/" } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    stubServiceWorker({ register });

    const result = await registerColetaServiceWorker();

    expect(result).toBe(registration);
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, SERVICE_WORKER_REGISTRATION_OPTIONS);
  });

  it("returns null when serviceWorker is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    const result = await registerColetaServiceWorker();

    expect(result).toBeNull();
  });
});
