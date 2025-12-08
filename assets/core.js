// assets/core.js
// Helper DOM cơ bản
export function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

// Lấy tháng đang chọn trên filter (YYYY-MM)
export function getMonthValue() {
  const sel = document.getElementById("monthFilter");
  if (sel && sel.value) return sel.value;

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Khởi tạo options cho monthFilter (12 tháng gần nhất)
export function initMonthFilter() {
  const sel = document.getElementById("monthFilter");
  if (!sel || sel.options.length) return; // đã khởi tạo

  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    options.push(new Option(ym, ym));
  }
  options.forEach((opt) => sel.add(opt));
  sel.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

// Toast gọn (Bootstrap Toast)
export function showToast(msg, type = "success") {
  const el = document.getElementById("appToast");
  if (!el) {
    console.log("[Toast]", type.toUpperCase(), msg);
    return;
  }

  el.classList.remove(
    "toast-success",
    "toast-error",
    "toast-info",
    "text-bg-success",
    "text-bg-danger",
    "text-bg-primary"
  );
  const map = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-info",
  };
  el.classList.add(map[type] || "toast-info");

  el.querySelector(".toast-body").textContent = msg;
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 });
  t.show();
}

// Overlay loading chung
export function setGlobalLoading(on) {
  const el = document.getElementById("appLoading");
  if (!el) return;
  el.classList.toggle("show", !!on);
}

// Cập nhật menu user góc phải
export function updateUserMenuUI(user) {
  const lbl = document.getElementById("userNameLabel"); // span trong nút dropdown
  const mLogin = document.getElementById("menu-login"); // <li> Đăng nhập Google
  const mLogout = document.getElementById("menu-logout"); // <li> Đăng xuất

  if (!lbl || !mLogin || !mLogout) return;

  if (user) {
    lbl.textContent = user.displayName || user.email || "Tài khoản";
    mLogin.classList.add("d-none");
    mLogout.classList.remove("d-none");
  } else {
    lbl.textContent = "Khách";
    mLogin.classList.remove("d-none");
    mLogout.classList.add("d-none");
  }
}

// Cập nhật tổng chi / thu trên navbar
export function updateNavbarStats(expTotal, incTotal) {
  const expEl = document.getElementById("navExpTotal");
  const incEl = document.getElementById("navIncTotal");
  if (expEl)
    expEl.textContent = `${Number(expTotal || 0).toLocaleString("vi-VN")}đ`;
  if (incEl)
    incEl.textContent = `${Number(incTotal || 0).toLocaleString("vi-VN")}đ`;
}

// Format tiền VND ngắn gọn
export function formatVND(n) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

// Helpers cho Dashboard/Export/Reports
export function prevYm(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return "";
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const sumAmounts = (arr) =>
  arr.reduce((s, x) => s + Number(x?.amount || 0), 0);

export const VND = (n) =>
  new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";

export const YM = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function lastMonths(n = 6) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    arr.push(YM(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return arr;
}

// Đọc filter tài khoản cho phần Báo cáo
export function getReportAccountFilter() {
  const sel = document.getElementById("accountSelect");
  if (!sel) return "all";
  const v = sel.value || "all";
  if (v === "Tất cả") return "all";
  return v;
}
