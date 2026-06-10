import { t } from "../constants/copy.vi.js";
import { PROFILE_VI } from "../constants/profile.vi.js";
import { formatCurrency } from "../../features/finance/finance.controller.js";

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

export function syncBrandUI() {
  const brandName = t("brand.name", "Hung Tran Finance");
  const brandTagline = t("brand.tagline", "Tài chính cá nhân");
  const authTitle = t("auth.title", brandName);
  const authSubtitle = t("auth.subtitle", brandTagline);

  document.title = brandName;

  const brandNameEl = document.getElementById("brandNameLabel");
  const brandTaglineEl = document.getElementById("brandTaglineLabel");
  const authTitleEl = document.getElementById("authTitle");
  const authSubtitleEl = document.getElementById("authSubtitle");
  const brandLinkEl = document.getElementById("brandHomeLink");

  if (brandNameEl) brandNameEl.textContent = brandName;
  if (brandTaglineEl) brandTaglineEl.textContent = brandTagline;
  if (authTitleEl) authTitleEl.textContent = authTitle;
  if (authSubtitleEl) authSubtitleEl.textContent = authSubtitle;
  if (brandLinkEl) brandLinkEl.setAttribute("aria-label", brandName);
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

export function updateNavbarStats(summary = {}) {
  const expenseTotal = Number(summary?.expenseTotal ?? summary?.expTotal ?? 0);
  const incomeTotal = Number(summary?.incomeTotal ?? summary?.incTotal ?? 0);
  const balanceTotal = Number(summary?.balanceTotal ?? summary?.totalBalance ?? 0);

  const balanceEl = document.getElementById("navBalanceTotal");
  const expEl = document.getElementById("navExpTotal");
  const incEl = document.getElementById("navIncTotal");
  const statsWrap = document.getElementById("topbarStats");

  if (balanceEl) {
    balanceEl.textContent = formatVNDCompact(balanceTotal);
    balanceEl.title = formatVND(balanceTotal);
  }
  if (expEl) {
    expEl.textContent = formatVNDCompact(expenseTotal);
    expEl.title = formatVND(expenseTotal);
  }
  if (incEl) {
    incEl.textContent = formatVNDCompact(incomeTotal);
    incEl.title = formatVND(incomeTotal);
  }
  if (statsWrap) statsWrap.classList.toggle("is-ready", true);
}

export function setTopbarStatsVisible(visible = false) {
  const statsWrap = document.getElementById("topbarStats");
  if (statsWrap) statsWrap.classList.toggle("is-visible", !!visible);
}

export function formatVND(n) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

export function formatVNDCompact(n) {
  const value = Number(n || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const scaled = abs / 1_000_000_000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} tỷ`;
  }

  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} tr`;
  }

  if (abs >= 10_000) {
    const scaled = abs / 1_000;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} k`;
  }

  return formatVND(value);
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

export const VND = (n) => formatCurrency(n);

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
