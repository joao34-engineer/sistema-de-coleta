import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEV_SW_CLEARED_SESSION_KEY } from "@/_app/pwa/model/pwa-shell";
import { PwaShell } from "@/_app/pwa/ui/pwa-shell";
import * as serviceWorkerRegistration from "@/_app/pwa/model/service-worker-registration";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function stubMatchMedia(): void {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

function stubUserAgent(): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => IOS_SAFARI_UA,
  });
}

function stubServiceWorkerController(controller: ServiceWorker | null): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      register: vi.fn(),
      getRegistrations: vi.fn().mockResolvedValue([]),
    },
  });
}

describe("PwaShell dev service worker cleanup", () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let registerSpy: ReturnType<typeof vi.spyOn>;
  let listenSpy: ReturnType<typeof vi.spyOn>;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
    stubMatchMedia();
    stubUserAgent();

    reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    registerSpy = vi.spyOn(serviceWorkerRegistration, "registerColetaServiceWorker").mockResolvedValue(null);
    listenSpy = vi.spyOn(serviceWorkerRegistration, "listenForWaitingWorker").mockReturnValue(() => undefined);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllEnvs();
    registerSpy.mockRestore();
    listenSpy.mockRestore();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("reloads once in development when a leftover controller remains", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubServiceWorkerController({} as ServiceWorker);

    render(<PwaShell />);

    await vi.waitFor(() => {
      expect(registerSpy).toHaveBeenCalledOnce();
    });

    expect(sessionStorage.getItem(DEV_SW_CLEARED_SESSION_KEY)).toBe("1");
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(listenSpy).not.toHaveBeenCalled();
  });

  it("does not reload again when the session guard is already set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    sessionStorage.setItem(DEV_SW_CLEARED_SESSION_KEY, "1");
    stubServiceWorkerController({} as ServiceWorker);

    render(<PwaShell />);

    await vi.waitFor(() => {
      expect(registerSpy).toHaveBeenCalledOnce();
    });

    expect(reloadMock).not.toHaveBeenCalled();
    expect(listenSpy).not.toHaveBeenCalled();
  });

  it("registers and listens for waiting workers in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorkerController(null);

    const registration = {
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
    registerSpy.mockResolvedValue(registration);

    render(<PwaShell />);

    await vi.waitFor(() => {
      expect(registerSpy).toHaveBeenCalledOnce();
    });

    expect(reloadMock).not.toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalledOnce();
    expect(listenSpy).toHaveBeenCalledWith(registration, expect.any(Function));
  });
});
