export const AUTH_LOCK = {
  allowedUid: "a7wUnSYvVKdTxlQV7jjVzK8ZxNN2",
  allowedEmail: "hungtran00.nt@gmail.com",
};

export const LAST_ROUTE_KEY = "htf_last_route";
export const AUTH_WARM_HINT_KEY = "htf_auth_hint_v1";
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 1200;

/** One-time migration from legacy NEXUS localStorage keys. */
export function migrateLegacyStorageKeys() {
  try {
    const pairs = [
      ["nexus_last_route", LAST_ROUTE_KEY],
      ["nexus_auth_hint_v1", AUTH_WARM_HINT_KEY],
    ];
    for (const [from, to] of pairs) {
      const value = localStorage.getItem(from);
      if (value == null) continue;
      if (localStorage.getItem(to) == null) localStorage.setItem(to, value);
      localStorage.removeItem(from);
    }
  } catch {
    // ignore storage errors
  }
}
