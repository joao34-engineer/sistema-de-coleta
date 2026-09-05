import { SHELL_CACHE_PREFIX } from "@/shared/lib/pwa/service-worker-protocol";
import { DEV_SW_CLEARED_SESSION_KEY } from "./pwa-shell";

/**
 * Inline script for the root layout `<head>`. Runs before Next.js body scripts so a
 * leftover dev service worker cannot serve stale `/_next/static/` chunks during module
 * evaluation. Production layouts must not include this script.
 */
export function buildDevServiceWorkerCleanupScript(): string {
  const sessionKey = JSON.stringify(DEV_SW_CLEARED_SESSION_KEY);
  const cachePrefix = JSON.stringify(SHELL_CACHE_PREFIX);

  return `(function(){try{var g=typeof globalThis!=="undefined"?globalThis:window;if(typeof g.navigator==="undefined"||!g.navigator.serviceWorker)return;var KEY=${sessionKey};var PREFIX=${cachePrefix};function cleanup(){return g.navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister();}));}).then(function(){if(typeof g.caches==="undefined")return;return g.caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf(PREFIX)===0;}).map(function(k){return g.caches.delete(k);}));});});}var controller=g.navigator.serviceWorker.controller;var cleared=g.sessionStorage.getItem(KEY);cleanup();if(!controller)return;if(!cleared){g.sessionStorage.setItem(KEY,"1");g.location.reload();return;}if(cleared==="1"){g.sessionStorage.setItem(KEY,"2");g.location.reload();}}catch(e){}})();`;
}
