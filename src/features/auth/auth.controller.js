import { watchAuth } from "../../services/firebase/auth.js";

export function initAuthWatcher(onReady) {
  return watchAuth(onReady);
}
