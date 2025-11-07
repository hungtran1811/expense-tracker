import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { firebaseConfig, AUTH_LOCK } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// cho phép chọn tài khoản mỗi lần
provider.setCustomParameters({ prompt: "select_account" });

export async function signIn() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    // nếu popup bị chặn, fallback redirect
    if (
      err?.code === "auth/popup-blocked" ||
      err?.code === "auth/cancelled-popup-request"
    ) {
      return signInWithRedirect(auth, provider);
    }
    throw err;
  }
}
export function signOutNow() {
  return signOut(auth);
}

// ---- Helpers DOM an toàn (tương thích UI cũ/mới)
function $id(id) {
  return document.getElementById(id);
}
function setTextSafe(el, text) {
  if (el) el.textContent = text;
}
function showEl(el, show) {
  if (!el) return;
  el.classList.toggle("d-none", !show);
}

// ---- Single-user guard
function enforceSingleUser(user) {
  if (!user) return false;
  const okUid = AUTH_LOCK.allowedUid && user.uid === AUTH_LOCK.allowedUid;
  const okEmail =
    AUTH_LOCK.allowedEmail && user.email === AUTH_LOCK.allowedEmail;
  return okUid || okEmail;
}

// ---- Cập nhật menu tài khoản (chịu được thiếu phần tử)
export function updateUserMenu(user) {
  const labelNew = $id("userMenuLabel"); // UI mới (đề xuất)
  const labelOld = $id("authBtnLabel"); // UI cũ (fallback)
  const menuSignIn = $id("menuSignIn"); // <li> Đăng nhập Google (UI mới)
  const menuSignOut = $id("menuSignOut"); // <li> Đăng xuất (UI mới)

  if (user) {
    const name = user.displayName || user.email || "Tài khoản";
    setTextSafe(labelNew, name);
    setTextSafe(labelOld, name); // nếu còn dùng UI cũ
    showEl(menuSignIn, false);
    showEl(menuSignOut, true);
  } else {
    setTextSafe(labelNew, "Đăng nhập");
    setTextSafe(labelOld, "Đăng nhập");
    showEl(menuSignIn, true);
    showEl(menuSignOut, false);
  }
}

// ---- Watch auth state
export function watchAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    // nếu có user nhưng không khớp lock -> signout ngay
    if (user && !enforceSingleUser(user)) {
      alert("Tài khoản này không được phép truy cập. Hệ thống sẽ đăng xuất.");
      await signOut(auth);
      updateUserMenu(null);
      onReady && onReady(null);
      return;
    }

    // cập nhật email ở trang Cài đặt (nếu có)
    const inEmail = $id("inEmail");
    if (inEmail) inEmail.value = user?.email || "";

    // cập nhật dropdown menu theo trạng thái hiện tại
    updateUserMenu(user);

    onReady && onReady(user);
  });
}

// ---- Bind nút menu (nếu có trong DOM)
$id("btnSignIn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signIn();
  } catch (err) {
    console.error(err);
    alert("Đăng nhập thất bại: " + (err?.message || err));
  }
});

$id("btnSignOut")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOutNow();
    updateUserMenu(null);
    location.hash = "#dashboard";
  } catch (err) {
    console.error(err);
    alert("Đăng xuất thất bại: " + (err?.message || err));
  }
});
