export const SERVICE_WORKER_URL = "/sw.js" as const;
export const SHELL_CACHE_NAME = "mjt-shell-v1" as const;
export const SKIP_WAITING_MESSAGE_TYPE = "SKIP_WAITING" as const;

export const SKIP_WAITING_MESSAGE = {
  type: SKIP_WAITING_MESSAGE_TYPE,
} as const;

export type ServiceWorkerUrl = typeof SERVICE_WORKER_URL;
export type ShellCacheName = typeof SHELL_CACHE_NAME;
export type SkipWaitingMessageType = typeof SKIP_WAITING_MESSAGE_TYPE;
export type SkipWaitingMessage = typeof SKIP_WAITING_MESSAGE;
