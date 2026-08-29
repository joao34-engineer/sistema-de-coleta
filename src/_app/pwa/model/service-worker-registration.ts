import { SERVICE_WORKER_URL } from "@/shared/lib/pwa/service-worker-protocol";

export const SERVICE_WORKER_REGISTRATION_OPTIONS = {
  scope: "/",
  updateViaCache: "none",
} as const satisfies RegistrationOptions;

export async function registerColetaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, SERVICE_WORKER_REGISTRATION_OPTIONS);
  } catch {
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
