import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "firebase/auth";
import { app } from "./app.js";
import { AUTH_LOCK, AUTH_WARM_HINT_KEY } from "../../shared/constants/keys.js";

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Không thể thiết lập lưu phiên đăng nhập local", err);
});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function setAuthWarmHint(enabled = true) {
  try {
    if (enabled) {
      localStorage.setItem(AUTH_WARM_HINT_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_WARM_HINT_KEY);
    }
  } catch (err) {
    console.warn("Không thể cập nhật auth warm hint", err);
  }
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    setAuthWarmHint(true);
    return result;
  } catch (err) {
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/cancelled-popup-request") {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export function signOutNow() {
  setAuthWarmHint(false);
  return signOut(auth);
}

export async function getCurrentIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return "";

  try {
    const token = await user.getIdToken(!!forceRefresh);
    return String(token || "");
  } catch {
    return "";
  }
}

function enforceSingleUser(user) {
  if (!user) return false;
  const okUid = AUTH_LOCK.allowedUid && user.uid === AUTH_LOCK.allowedUid;
  const okEmail = AUTH_LOCK.allowedEmail && user.email === AUTH_LOCK.allowedEmail;
  return okUid || okEmail;
}

export function watchAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (user && !enforceSingleUser(user)) {
      alert("Tài khoản này không được phép truy cập. Hệ thống sẽ đăng xuất.");
      await signOut(auth);
      setAuthWarmHint(false);
      onReady && onReady(null);
      return;
    }

    setAuthWarmHint(!!user);
    onReady && onReady(user || null);
  });
}

export function bindAuthButtons() {
  const bindSignIn = (id) => {
    document.getElementById(id)?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await signIn();
      } catch (err) {
        console.error("[signIn]", err);
        alert(`Đăng nhập thất bại: ${err?.message || err}`);
      }
    });
  };

  bindSignIn("btnLoginGoogle");
  bindSignIn("btnLoginGoogleInline");

  document.getElementById("btnLogout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOutNow();
    } catch (err) {
      console.error("[signOut]", err);
      alert(`Đăng xuất thất bại: ${err?.message || err}`);
    }
  });
}
