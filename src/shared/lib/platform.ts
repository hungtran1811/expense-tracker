/** Detect Capacitor / Electron shells so auth & SW behave correctly. */

export function isCapacitorShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function isElectronShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { electronAPI?: unknown; process?: { versions?: { electron?: string } } };
  if (w.electronAPI) return true;
  return Boolean(w.process?.versions?.electron);
}

export function isNativeShell(): boolean {
  return isCapacitorShell() || isElectronShell();
}

/** Skip web service worker inside native shells (local assets / file protocol). */
export function shouldRegisterServiceWorker(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (isNativeShell()) return false;
  if (typeof location !== "undefined" && location.protocol === "file:") return false;
  return true;
}
