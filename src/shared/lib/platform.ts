/** Web-only shell helpers (PWA). */

/** Kept for call-sites; always false after removing native packaging. */
export function isNativeShell(): boolean {
  return false;
}

/** Register service worker in production web builds. */
export function shouldRegisterServiceWorker(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return true;
}
