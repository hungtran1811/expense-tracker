import { t } from "../constants/copy.vi.js";
import { PROFILE_VI } from "../constants/profile.vi.js";

export function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export function getMonthValue() {
  const sel = document.getElementById("monthFilter");
  if (sel && sel.value) return sel.value;

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function initMonthFilter() {
  const sel = document.getElementById("monthFilter");
  if (!sel || sel.options.length) return;

  const now = new Date();
  const options = [];

  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    options.push(new Option(label, ym));
  }

  options.forEach((opt) => sel.add(opt));
  sel.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function showToast(msg, type = "success") {
  const el = document.getElementById("appToast");
  if (!el) {
    console.log("[Toast]", type.toUpperCase(), msg);
    return;
  }

  el.classList.remove("toast-success", "toast-error", "toast-info");

  const map = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-info",
    danger: "toast-error",
  };

  el.classList.add(map[type] || "toast-info");
  const body = el.querySelector(".toast-body");
  if (body) body.textContent = msg;

  const toast = bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 });
  toast.show();
}

export function setGlobalLoading(on) {
  const el = document.getElementById("appLoading");
  if (!el) return;
  el.classList.toggle("show", !!on);
}

export function updateUserMenuUI(user) {
  const lbl = document.getElementById("userNameLabel");
  const mLogin = document.getElementById("menu-login");
  const mLogout = document.getElementById("menu-logout");

  if (!lbl || !mLogin || !mLogout) return;

  if (user) {
    lbl.textContent = user.displayName || user.email || PROFILE_VI.displayName || "Hưng Trần";
    mLogin.classList.add("d-none");
    mLogout.classList.remove("d-none");
  } else {
    lbl.textContent = t("common.guest", "Khách");
    mLogin.classList.remove("d-none");
    mLogout.classList.add("d-none");
  }
}

export function updateNavbarStats(expTotal, incTotal) {
  const expEl = document.getElementById("navExpTotal");
  const incEl = document.getElementById("navIncTotal");
  if (expEl) expEl.textContent = formatVND(expTotal);
  if (incEl) incEl.textContent = formatVND(incTotal);
}

export function formatVND(n) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

export function prevYm(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return "";

  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const sumAmounts = (arr) =>
  (Array.isArray(arr) ? arr : []).reduce((sum, item) => sum + Number(item?.amount || 0), 0);

export const VND = (n) => `${new Intl.NumberFormat("vi-VN").format(Number(n || 0))}đ`;

export const YM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function lastMonths(n = 6) {
  const arr = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i -= 1) {
    arr.push(YM(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }

  return arr;
}

export function getReportAccountFilter() {
  const sel = document.getElementById("accountSelect");
  if (!sel) return "all";

  const value = sel.value || "all";
  if (value === "Tất cả" || value === "Tất cả tài khoản") return "all";
  return value;
}
