import {
  SERVICE_WORKER_URL,
  SHELL_CACHE_PREFIX,
} from "@/shared/lib/pwa/service-worker-protocol";

export const SERVICE_WORKER_REGISTRATION_OPTIONS = {
  scope: "/",
  updateViaCache: "none",
} as const satisfies RegistrationOptions;

export async function unregisterColetaServiceWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error: unknown) {
    void error;
  }
}

export async function dropShellCaches(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }

  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((name) => name.startsWith(SHELL_CACHE_PREFIX)).map((name) => caches.delete(name)),
    );
  } catch (error: unknown) {
    void error;
  }
}

export async function registerColetaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      await unregisterColetaServiceWorkers();
      await dropShellCaches();
    } catch (error: unknown) {
      void error;
    }

    return null;
  }

  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, SERVICE_WORKER_REGISTRATION_OPTIONS);
  } catch (error: unknown) {
    void error;
    return null;
  }
}

export function listenForWaitingWorker(
  registration: ServiceWorkerRegistration,
  onWaiting: (worker: ServiceWorker) => void,
): () => void {
  const announceWaiting = () => {
    if (registration.waiting) {
      onWaiting(registration.waiting);
    }
  };

  const bindInstalling = (worker: ServiceWorker | null) => {
    if (worker === null) {
      return;
    }

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") {
        announceWaiting();
      }
    });
  };

  const onUpdateFound = () => {
    bindInstalling(registration.installing);
  };

  announceWaiting();
  bindInstalling(registration.installing);
  registration.addEventListener("updatefound", onUpdateFound);

  return () => {
    registration.removeEventListener("updatefound", onUpdateFound);
  };
}
