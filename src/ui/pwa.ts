/**
 * Service worker registration.
 *
 * Registered ONLY in production: in development the worker intercepts the Vite
 * dev-server requests, serves stale bundles and fights the HMR client
 * (ADR-0003). The app works without it; offline is the only thing lost.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  // A failed registration is not an app failure: the game stays playable, it
  // just loses offline support.
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // No offline in this session; nothing to surface to the player.
  });
}
