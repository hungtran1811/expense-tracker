import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { app } from "./app";
import { AUTH_LOCK, AUTH_WARM_HINT_KEY } from "../../shared/constants/keys";
import { appAlert } from "../../shared/ui/ConfirmDialog";

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Không thể thiết lập lưu phiên đăng nhập local", err);
});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function setAuthWarmHint(enabled = true) {
  try {
    if (enabled) localStorage.setItem(AUTH_WARM_HINT_KEY, "1");
    else localStorage.removeItem(AUTH_WARM_HINT_KEY);
  } catch (err) {
    console.warn("Không thể cập nhật auth warm hint", err);
  }
}

/** Complete redirect flow after returning from Google (popup fallback). */
export async function completeRedirectSignIn() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) setAuthWarmHint(true);
    return result;
  } catch (err) {
    console.warn("Redirect sign-in failed", err);
    throw err;
  }
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    setAuthWarmHint(true);
    return result;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  setAuthWarmHint(true);
  return result;
}

export function signOutNow() {
  setAuthWarmHint(false);
  return signOut(auth);
}

function enforceSingleUser(user: User) {
  const okUid = AUTH_LOCK.allowedUid && user.uid === AUTH_LOCK.allowedUid;
  const email = (user.email || "").trim().toLowerCase();
  const okEmail = AUTH_LOCK.allowedEmails.some((item) => item.toLowerCase() === email);
  return !!(okUid || okEmail);
}

export function watchAuth(onReady: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user && !enforceSingleUser(user)) {
      await appAlert({
        title: "Không có quyền truy cập",
        message: "Tài khoản này không được phép truy cập. Hệ thống sẽ đăng xuất.",
        confirmLabel: "Đã hiểu",
      });
      await signOut(auth);
      setAuthWarmHint(false);
      onReady(null);
      return;
    }
    if (user) setAuthWarmHint(true);
    onReady(user);
  });
}
