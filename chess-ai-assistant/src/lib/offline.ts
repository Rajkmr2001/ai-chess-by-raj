/**
 * Registers the offline service worker in production builds only.
 * It is intentionally optional: if the browser or the host does not support
 * it, the app keeps working exactly as before.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Service workers need a secure context: HTTPS, or localhost / 127.0.0.1.
  if (!window.isSecureContext) return;

  const base = import.meta.env.BASE_URL || '/';
  const swUrl = new URL(`${base}sw.js`, window.location.origin).toString();

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: base }).catch(() => {
      // Offline caching is a bonus; never break the app because of it.
    });
  });
}
