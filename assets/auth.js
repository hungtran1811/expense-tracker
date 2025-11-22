// assets/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { firebaseConfig, AUTH_LOCK } from "./firebaseConfig.js";

// --- Init Firebase + Auth ---
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// --- Provider Google ---
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// --- Hàm đăng nhập ---
export async function signIn() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    // popup bị chặn -> fallback redirect
    if (
      err?.code === "auth/popup-blocked" ||
      err?.code === "auth/cancelled-popup-request"
    ) {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

// --- Hàm đăng xuất ---
export function signOutNow() {
  return signOut(auth);
}

// --- Single-user guard ---
function enforceSingleUser(user) {
  if (!user) return false;
  const okUid = AUTH_LOCK.allowedUid && user.uid === AUTH_LOCK.allowedUid;
  const okEmail =
    AUTH_LOCK.allowedEmail && user.email === AUTH_LOCK.allowedEmail;
  return okUid || okEmail;
}

// --- Theo dõi trạng thái đăng nhập ---
// onReady(user | null) sẽ được gọi mỗi lần auth thay đổi
export function watchAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    // Khoá 1 user
    if (user && !enforceSingleUser(user)) {
      alert("Tài khoản này không được phép truy cập. Hệ thống sẽ đăng xuất.");
      await signOut(auth);
      onReady && onReady(null);
      return;
    }

    onReady && onReady(user || null);
  });
}

// --- Gắn event cho nút Đăng nhập / Đăng xuất trong dropdown ---
// HTML hiện tại:
//  <button class="dropdown-item" id="btnLoginGoogle">Đăng nhập Google</button>
//  <button class="dropdown-item" id="btnLogout">Đăng xuất</button>

document
  .getElementById("btnLoginGoogle")
  ?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signIn();
    } catch (err) {
      console.error("[signIn]", err);
      alert("Đăng nhập thất bại: " + (err?.message || err));
    }
  });

document.getElementById("btnLogout")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOutNow();
  } catch (err) {
    console.error("[signOut]", err);
    alert("Đăng xuất thất bại: " + (err?.message || err));
  }
});
