import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { app } from "./app.js";
import { AUTH_LOCK } from "../../shared/constants/keys.js";

export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export async function signIn() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/cancelled-popup-request") {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export function signOutNow() {
  return signOut(auth);
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
      onReady && onReady(null);
      return;
    }

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
