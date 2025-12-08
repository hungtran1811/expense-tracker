import {
  populateExpenseFiltersOptions,
  applyExpenseFiltersAndRender,
} from "./expenses.js";
import { refreshBalances } from "./accounts.js";
import { setActiveRoute } from "./router.js";
import { watchAuth, auth } from "./auth.js";
import {
  mustGet,
  getMonthValue,
  initMonthFilter,
  showToast,
  setGlobalLoading,
  updateUserMenuUI,
  updateNavbarStats,
  formatVND,
  prevYm,
  sumAmounts,
  VND,
  YM,
  lastMonths,
  getReportAccountFilter,
} from "./core.js";

import {
  addExpense,
  listExpensesByMonth,
  saveProfile,
  readProfile,
  getExpense,
  updateExpense,
  deleteExpense,
  addAccount,
  listAccounts,
  addIncome,
  updateIncome,
  deleteIncome,
  listIncomesByMonth,
  balancesByAccount,
  getIncome,
  addTransfer,
  updateAccount,
  deleteAccountWithReassign,
  balancesByAccountTotal,
} from "./db.js";
import {
  fillSelectMonths,
  renderExpensesTable,
  renderAccountsTable,
  fillAccountSelect,
  renderBalancesList,
  renderIncomesTable,
} from "./ui.js";
import { renderIncomesSection } from "./incomes.js";
import {
  refreshTopCategories,
  renderOverviewLower,
  renderReportsCharts,
  renderReportInsights,
  renderReportCashflow,
} from "./reports.js";

/* =========================
 * 2) APP STATE (biến dùng chung)
 * ========================= */
let _accounts = []; // danh sách tài khoản của user
let _currentUser = null; // firebase user hiện tại
let _expTotal = 0;
let _incTotal = 0;
let _pendingDeleteId = null; // id chi tiêu đang chờ xoá
let _pendingDeleteIncomeId = null; // id thu nhập đang chờ xoá
let _allExpenses = []; // toàn bộ chi tiêu của tháng đang chọn
let _expenseFilters = {
  category: "all",
  account: "all",
  search: "",
};

// Filter cho trang Báo cáo (phân tích)
let _reportFilters = {
  account: "all", // 'all' = tất cả tài khoản
};

let _allIncomes = [];
let _incomeFilters = {
  account: "all",
  search: "",
};

// Tính tổng tháng này + delta so với tháng trước, cập nhật UI
async function refreshDashboardStats(uid) {
  const ym = getMonthValue();
  const ymPrev = prevYm(ym);

  const [expThis, expPrev, incThis, incPrev] = await Promise.all([
    listExpensesByMonth(uid, ym),
    listExpensesByMonth(uid, ymPrev),
    listIncomesByMonth(uid, ym),
    listIncomesByMonth(uid, ymPrev),
  ]);

  _expTotal = sumAmounts(expThis);
  _incTotal = sumAmounts(incThis);
  const expPrevSum = sumAmounts(expPrev);
  const incPrevSum = sumAmounts(incPrev);

  updateNavbarStats(_expTotal, _incTotal);
  updateDashboardTotals?.();
  updateDashboardMonthBadge?.();

  const elDelta = document.getElementById("deltaMonth");
  if (elDelta) {
    const expDelta = _expTotal - expPrevSum; // dương = chi tăng
    const incDelta = _incTotal - incPrevSum; // dương = thu tăng
    const sgn = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±");
    elDelta.innerHTML =
      `So với tháng trước — ` +
      `Chi: <b>${sgn(expDelta)}${formatVND(Math.abs(expDelta))}</b> • ` +
      `Thu: <b>${sgn(incDelta)}${formatVND(Math.abs(incDelta))}</b>`;
    elDelta.classList.remove("text-success", "text-danger");
    const netThis = _incTotal - _expTotal;
    const netPrev = incPrevSum - expPrevSum;
    elDelta.classList.add(netThis >= netPrev ? "text-success" : "text-danger");
  }
}

// Xuất CSV gộp Thu & Chi trong tháng hiện tại
async function exportCsvCurrentMonth(uid) {
  const ym = getMonthValue();
  const [expenses, incomes] = await Promise.all([
    listExpensesByMonth(uid, ym),
    listIncomesByMonth(uid, ym),
  ]);
  const toISO = (d) => {
    const obj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return isNaN(obj) ? "" : obj.toISOString().slice(0, 10);
  };
  const rows = [
    ...expenses.map((x) => ({
      Type: "Expense",
      Date: toISO(x.date),
      Name: x.name || "",
      Amount: Number(x.amount || 0),
      Category: x.category || "",
      Account: x.account || "",
      Note: (x.note || "").replace(/\r?\n/g, " "),
    })),
    ...incomes.map((i) => ({
      Type: "Income",
      Date: toISO(i.date),
      Name: i.name || "",
      Amount: Number(i.amount || 0),
      Category: "",
      Account: i.account || "",
      Note: (i.note || "").replace(/\r?\n/g, " "),
    })),
  ].sort((a, b) => a.Date.localeCompare(b.Date));

  const header = [
    "Type",
    "Date",
    "Name",
    "Amount",
    "Category",
    "Account",
    "Note",
  ];
  const csvBody = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.Type,
        r.Date,
        `"${r.Name.replace(/"/g, '""')}"`,
        r.Amount,
        `"${r.Category}"`,
        `"${r.Account}"`,
        `"${r.Note.replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  // 🔹 THÊM BOM UTF-8 để Excel hiểu đúng tiếng Việt
  const bom = "\uFEFF"; // UTF-8 BOM
  const blob = new Blob([bom + csvBody], {
    type: "text/csv;charset=utf-8;",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transactions_${ym}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Đổi badge tháng theo giá trị #monthFilter (YYYY-MM)
function updateDashboardMonthBadge() {
  const b = document.getElementById("monthBadge");
  if (!b) return;
  const ym = getMonthValue(); // "2025-11"
  const [y, m] = ym.split("-").map(Number);
  b.textContent = `Tháng ${String(m).padStart(2, "0")}/${y}`;
}

// Đổ số liệu Dashboard (từ _expTotal, _incTotal)
function updateDashboardTotals() {
  const elTotal = document.getElementById("totalThisMonth");
  const elDelta = document.getElementById("deltaMonth");
  if (!elTotal || !elDelta) return;

  // hiển thị: "Chi: X — Thu: Y"
  elTotal.innerHTML = `
    <h3> Chi: <b>${formatVND(_expTotal)}</b> </h3>
    <h3> Thu: <b> ${formatVND(_incTotal)} </b> </h3>
  `;

  // chênh lệch (Thu - Chi)
  const delta = Number(_incTotal) - Number(_expTotal);
  elDelta.textContent = `Chênh lệch: ${formatVND(delta)}`;
  elDelta.classList.remove("text-success", "text-danger");
  elDelta.classList.add(delta >= 0 ? "text-success" : "text-danger");
}

/* =========================
 * 4) LOADERS & REFRESHERS
 * ========================= */

// 4.1. Tải tài khoản & fill dropdown (Thêm chi / Sửa chi / Modal / Thêm thu nhập)
async function loadAccountsAndFill(uid) {
  _accounts = await listAccounts(uid);
  // Transfer modal selects
  fillAccountSelect?.(document.getElementById("tfFrom"), _accounts);
  fillAccountSelect?.(document.getElementById("tfTo"), _accounts);

  const tfFrom = document.getElementById("tfFrom");
  const tfTo = document.getElementById("tfTo");
  if (tfFrom && tfTo && tfFrom.value === tfTo.value) {
    const second = tfTo.options.length > 1 ? tfTo.options[1].value : tfTo.value;
    tfTo.value = second;
  }

  // Bảng tài khoản (nếu trang có)
  const tbodyAcc = document.querySelector("#accountsTable tbody");
  if (tbodyAcc && typeof renderAccountsTable === "function") {
    renderAccountsTable(tbodyAcc, _accounts);
  }

  // Đổ vào các select tài khoản (nếu phần tử tồn tại)
  const targets = ["inAccount", "mAccount", "eAccount", "iAccount"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  targets.forEach((sel) => fillAccountSelect?.(sel, _accounts));

  // ... sau khi _accounts đã được gán và các select khác đã được fill

  // Đổ tài khoản vào filter Báo cáo (accountSelect)
  const reportAccSelect = document.getElementById("accountSelect");
  if (reportAccSelect) {
    const current = _reportFilters.account || "all";
    reportAccSelect.innerHTML =
      '<option value="all">Tất cả tài khoản</option>' +
      _accounts
        .map((acc) => `<option value="${acc.name}">${acc.name}</option>`)
        .join("");

    if (
      current !== "all" &&
      [...reportAccSelect.options].some((o) => o.value === current)
    ) {
      reportAccSelect.value = current;
    } else {
      reportAccSelect.value = "all";
      _reportFilters.account = "all";
    }
  }
}

// 4.2. Tải & render CHI TIÊU theo tháng (nếu bảng tồn tại) + cập nhật tổng tháng
async function refreshExpenses(uid) {
  const ym = getMonthValue(); // YYYY-MM
  const list = await listExpensesByMonth(uid, ym);

  // Lưu list thô
  _allExpenses = Array.isArray(list) ? list : [];

  // Đổ options filter + render bảng theo filter hiện tại
  populateExpenseFiltersOptions(_allExpenses);
  _expenseFilters = applyExpenseFiltersAndRender(_allExpenses, _expenseFilters);

  // Cập nhật tổng chi (nếu anh vẫn đang dùng chỗ này)
  _expTotal = _allExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  updateNavbarStats?.(_expTotal, _incTotal);
  updateDashboardTotals?.();
}

async function refreshIncomes(uid) {
  const ym = getMonthValue(); // tháng đang chọn
  const list = await listIncomesByMonth(uid, ym);

  // Lưu list thô của tháng để filter
  _allIncomes = Array.isArray(list) ? list : [];

  // Đổ options filter tài khoản thu nhập + render theo filter hiện tại
  populateIncomeFilterOptions(_allIncomes);
  applyIncomeFiltersAndRender();

  // Tổng thu tháng này (cho navbar + dashboard): tính theo TẤT CẢ khoản thu trong tháng
  _incTotal = _allIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  updateNavbarStats();
  updateDashboardTotals?.();
}

function populateIncomeFilterOptions(list) {
  const accSel = document.getElementById("incomeAccountFilter");
  if (!accSel) return;

  const accounts = [
    ...new Set(list.map((i) => (i.account || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const prevAcc = accSel.value || "all";

  accSel.innerHTML =
    '<option value="all">Tất cả tài khoản</option>' +
    accounts.map((a) => `<option value="${a}">${a}</option>`).join("");

  if ([...accSel.options].some((o) => o.value === prevAcc)) {
    accSel.value = prevAcc;
  }
}

function applyIncomeFiltersAndRender() {
  const accSel = document.getElementById("incomeAccountFilter");
  const searchEl = document.getElementById("incomeSearch");

  const account = accSel?.value || "all";
  const keyword = (searchEl?.value || "").trim().toLowerCase();

  _incomeFilters = { account, search: keyword };

  let list = Array.isArray(_allIncomes) ? [..._allIncomes] : [];

  if (account !== "all") {
    const a = account.toLowerCase();
    list = list.filter((i) => (i.account || "").toLowerCase() === a);
  }

  if (keyword) {
    list = list.filter((i) => {
      const name = (i.name || "").toLowerCase();
      const note = (i.note || "").toLowerCase();
      return name.includes(keyword) || note.includes(keyword);
    });
  }

  // Dùng incomes.js để render lại bảng
  renderIncomesSection(list);

  // Cập nhật info nhỏ dưới bảng (nếu có)
  const infoEl = document.getElementById("incomeFilterInfo");
  if (infoEl) {
    const totalFiltered = list.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAll = _allIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);

    if (
      !_allIncomes.length ||
      (list.length === _allIncomes.length && account === "all" && !keyword)
    ) {
      infoEl.textContent = `${list.length} khoản thu • ${formatVND(
        totalFiltered
      )} trong tháng này`;
    } else {
      infoEl.textContent = `${list.length}/${
        _allIncomes.length
      } khoản thu • ${formatVND(totalFiltered)} (từ tổng ${formatVND(
        totalAll
      )})`;
    }
  }
}

// 4.5. Refresh tất cả phần phụ thuộc tháng (gọi khi login/đổi tháng/CRUD)
async function refreshAll(uid) {
  if (!uid) return;
  setGlobalLoading(true);
  try {
    await Promise.all([
      refreshExpenses(uid),
      refreshIncomes(uid),
      loadAccountsAndFill(uid),
      renderOverviewLower(uid),
    ]);

    await refreshBalances(uid);
    updateDashboardMonthBadge?.();

    await Promise.all([
      refreshDashboardStats(uid),
      refreshTopCategories(uid),
      renderReportsCharts(uid, _reportFilters.account),
      renderReportInsights(uid, _reportFilters.account),
      renderReportCashflow(uid),
    ]);
  } finally {
    setGlobalLoading(false);
  }
}

async function suggestCategoryByAI(name, note) {
  try {
    const catSelect = document.getElementById("eCategory");
    if (!catSelect) return;

    const categories = Array.from(catSelect.options).map((o) => o.value);

    const res = await fetch("/.netlify/functions/ai-categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, note, categories }),
    });

    if (!res.ok) {
      console.warn("AI categorize request failed");
      return;
    }

    const data = await res.json();

    if (data.category && categories.includes(data.category)) {
      catSelect.value = data.category;
      // Nếu muốn: highlight nhẹ để biết là AI chọn giúp
      // catSelect.classList.add("ai-suggested");
      // setTimeout(() => catSelect.classList.remove("ai-suggested"), 800);
    }
  } catch (err) {
    console.error("suggestCategoryByAI error:", err);
  }
}

async function doDeleteExpense() {
  try {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    if (!_pendingDeleteId) return;

    // Gọi API xoá
    await deleteExpense(user.uid, _pendingDeleteId);

    // Đóng modal nếu đang mở
    const modalEl = document.getElementById("confirmDeleteModal");
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    // Refresh bảng + số dư + toast
    await refreshExpenses(user.uid);
    await refreshBalances(user.uid);
    showToast?.("Đã xoá chi tiêu!");
  } catch (err) {
    console.error("[DeleteExpense] ", err);
    showToast(err?.message || "Không thể xoá");
  } finally {
    _pendingDeleteId = null;
  }
}

async function doDeleteIncome() {
  try {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");
    if (!_pendingDeleteIncomeId) return;

    await deleteIncome(user.uid, _pendingDeleteIncomeId);

    // đóng modal nếu đang mở
    const modalEl = document.getElementById("confirmDeleteModal");
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    await refreshIncomes(user.uid);
    await refreshBalances(user.uid);
    showToast("Đã xoá thu nhập!");
  } catch (err) {
    console.error("[DeleteIncome] ", err);
    showToast(err?.message || "Không thể xoá thu nhập", "error");
  } finally {
    _pendingDeleteIncomeId = null;
  }
}

// Đồng bộ danh sách & giá trị tháng từ #monthFilter sang #incomeMonthFilter
function syncIncomeMonthFilterFromGlobal() {
  const globalSel = document.getElementById("monthFilter"); // ở trang Chi tiêu
  const incomeSel = document.getElementById("incomeMonthFilter"); // ở tab Tài khoản
  if (!globalSel || !incomeSel) return;

  // copy nguyên options & value
  incomeSel.innerHTML = globalSel.innerHTML;
  incomeSel.value = globalSel.value;
}

/* =========================
 * 5) AUTH FLOW
 * ========================= */

// Khởi tạo month filter ngay khi load
initMonthFilter();
syncIncomeMonthFilterFromGlobal();

// Theo dõi đăng nhập
watchAuth(async (user) => {
  _currentUser = user || null;
  updateUserMenuUI(user);

  if (user) {
    await refreshAll(user.uid);
    updateDashboardMonthBadge?.();
  } else {
    // clear UI tối thiểu nếu cần
    const wrap = document.getElementById("balanceList");
    if (wrap) wrap.innerHTML = '<div class="text-muted">Chưa có dữ liệu</div>';
  }
});

/* =========================
 * 6) EVENT LISTENERS
 * ========================= */

// 6.1. Đăng nhập / Đăng xuất từ dropdown
// document.getElementById("btnSignIn")?.addEventListener("click", async (e) => {
//   e.preventDefault();
//   try {
//     await signInWithGoogle();
//   } catch (err) {
//     console.error(err);
//     showToast("Đăng nhập thất bại: " + (err.message || err), "error");
//   }
// });

// document.getElementById("btnSignOut")?.addEventListener("click", async (e) => {
//   e.preventDefault();
//   try {
//     await signOutGoogle();
//   } catch (err) {
//     console.error(err);
//     showToast("Đăng xuất thất bại: " + (err.message || err), "error");
//   }
// });

// Mở modal Thêm chi: fill account + ngày
document
  .getElementById("addExpenseModal")
  ?.addEventListener("show.bs.modal", () => {
    // đổ tài khoản vào select
    if (typeof fillAccountSelect === "function") {
      fillAccountSelect(document.getElementById("eAccount"), _accounts);
    } else if (window._accounts) {
      const sel = document.getElementById("eAccount");
      sel.innerHTML = _accounts
        .map((a) => `<option value="${a.name}">${a.name}</option>`)
        .join("");
    }

    // chọn mặc định (nếu có)
    const def = Array.isArray(_accounts)
      ? _accounts.find((a) => a.isDefault)
      : null;
    if (def) document.getElementById("eAccount").value = def.name;

    // ngày = ngày hiện tại nhưng KHỚP tháng đang lọc (nếu có filter)
    const ym = typeof getMonthValue === "function" ? getMonthValue() : "";
    const today = new Date();
    let y = today.getFullYear(),
      m = today.getMonth() + 1,
      d = today.getDate();
    if (/^\d{4}-\d{2}$/.test(ym)) {
      const [Y, M] = ym.split("-").map(Number);
      y = Y;
      m = M;
    }
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("eDate").value = `${y}-${pad(m)}-${pad(d)}`;

    // clear lỗi & reset text
    document.getElementById("aeError").classList.add("d-none");
    ["eName", "eAmount", "eNote"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  });

// Submit thêm chi
document
  .getElementById("btnAddExpense")
  ?.addEventListener("click", async () => {
    const btn = document.getElementById("btnAddExpense");
    const errBox = document.getElementById("aeError");

    function showErr(msg) {
      if (!errBox) return showToast(msg, "error");
      errBox.textContent = msg;
      errBox.classList.remove("d-none");
    }

    function hideErr() {
      errBox?.classList.add("d-none");
    }

    try {
      const { auth } = await import("./auth.js");
      const user = auth.currentUser;
      if (!user) return showErr("Vui lòng đăng nhập");

      const name = document.getElementById("eName").value.trim();
      const amount = document.getElementById("eAmount").value;
      const date = document.getElementById("eDate").value; // yyyy-mm-dd
      const category = document.getElementById("eCategory").value;
      const account = document.getElementById("eAccount").value;
      const note = document.getElementById("eNote").value.trim();

      hideErr();
      btn.disabled = true;

      await addExpense(user.uid, {
        name,
        amount,
        date,
        category,
        account,
        note,
      });

      // đóng modal + reset
      bootstrap.Modal.getInstance(
        document.getElementById("addExpenseModal")
      )?.hide();
      ["eName", "eAmount", "eNote"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      // refresh bảng + số dư + nav
      await refreshExpenses(user.uid);
      await refreshBalances(user.uid);
      if (typeof showToast === "function") showToast("Đã thêm chi tiêu!");
    } catch (err) {
      console.error("[AddExpense]", err);
      showErr(err?.message || "Không thể thêm chi tiêu");
    } finally {
      btn.disabled = false;
    }
  });

document
  .querySelector("#expensesTable tbody")
  ?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;

    if (btn.classList.contains("btn-expense-edit")) {
      try {
        const { auth } = await import("./auth.js");
        const user = auth.currentUser;
        if (!user) {
          return showToast("Vui lòng đăng nhập trước", "error");
        }

        // 1) Lấy dữ liệu từ Firestore
        let x = null;
        try {
          x = await getExpense(user.uid, id);
        } catch (err) {
          console.warn("[getExpense] fail, fallback to row:", err);
        }

        // 2) Nếu không lấy được => fallback từ các ô trong dòng
        if (!x) {
          const tds = tr.querySelectorAll("td");
          x = {
            id,
            // dd/MM -> không convert lại ngày vì không có đủ thông tin
            name: tds[1]?.textContent?.trim() || "",
            category: tds[2]?.innerText?.trim() || "Khác",
            account: tds[3]?.textContent?.trim() || "",
            amount: Number((tds[4]?.textContent || "").replace(/\D/g, "")) || 0,
            note: "",
            date: null,
          };
        }

        // 3) Đổ danh sách tài khoản cho select trước khi set value
        if (typeof fillAccountSelect === "function") {
          fillAccountSelect(mustGet("edAccount"), _accounts);
        }

        // 4) Convert Timestamp -> yyyy-mm-dd
        let ymd = "";
        if (x.date) {
          const d = x.date.seconds
            ? new Date(x.date.seconds * 1000)
            : x.date.toDate
            ? x.date.toDate()
            : new Date(x.date);
          if (d instanceof Date && !isNaN(d))
            ymd = d.toISOString().slice(0, 10);
        }

        // 5) Gán vào form (nếu thiếu field nào sẽ báo rõ)
        mustGet("edId").value = x.id;
        mustGet("edName").value = x.name || "";
        mustGet("edAmount").value = Number(x.amount || 0);
        mustGet("edDate").value = ymd; // có thể rỗng -> sẽ giữ nguyên ngày cũ khi lưu
        mustGet("edCategory").value = x.category || "Khác";
        mustGet("edAccount").value = x.account || "";
        mustGet("edNote").value = x.note || "";

        // Nếu tài khoản cũ chưa có trong dropdown -> thêm tạm rồi chọn
        const sel = mustGet("edAccount");
        if (x.account && ![...sel.options].some((o) => o.value === x.account)) {
          sel.add(new Option(x.account, x.account, true, true));
        }

        // 6) Mở modal sau khi fill xong
        new bootstrap.Modal(mustGet("editExpenseModal")).show();

        // Log để bạn thấy giá trị đã fill
        console.debug("[EditExpense] filled:", {
          id: x.id,
          name: x.name,
          amount: x.amount,
          ymd,
          category: x.category,
          account: x.account,
        });
      } catch (err) {
        console.error("[EditExpense] error:", err);
        showToast("Không thể mở form sửa: " + (err.message || err), "error");
      }
    }
  });

document
  .getElementById("btnConfirmDelete")
  ?.addEventListener("click", async () => {
    if (_pendingDeleteIncomeId) {
      await doDeleteIncome();
    } else if (_pendingDeleteId) {
      await doDeleteExpense();
    }
  });

document
  .getElementById("btnSaveExpense")
  ?.addEventListener("click", async () => {
    if (!_currentUser) return;

    const id = document.getElementById("edId").value;
    const payload = {
      name: document.getElementById("edName").value.trim(),
      amount: document.getElementById("edAmount").value,
      date: document.getElementById("edDate").value, // có thể để trống -> không đổi ngày
      category: document.getElementById("edCategory").value,
      account: document.getElementById("edAccount").value,
      note: document.getElementById("edNote").value.trim(),
    };

    try {
      await updateExpense(_currentUser.uid, id, payload);
      bootstrap.Modal.getInstance(
        document.getElementById("editExpenseModal")
      )?.hide();
      await refreshExpenses(_currentUser.uid);
      await refreshBalances(_currentUser.uid);
      if (typeof showToast === "function") showToast("Đã cập nhật chi tiêu!");
    } catch (err) {
      console.error("[updateExpense]", err);
      showToast("Không thể cập nhật: " + (err.message || err), "error");
    }
  });

// Delegation cho bảng Chi tiêu
document
  .querySelector("#expensesTable tbody")
  ?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    if (!id) return;

    // ... (đoạn SỬA của bạn giữ nguyên)

    // Nhấn "Xoá"
    if (btn.classList.contains("btn-expense-del")) {
      _pendingDeleteId = id;
      _pendingDeleteIncomeId = null; // clear phía thu

      const m = document.getElementById("confirmDeleteModal");
      if (m) {
        const titleEl = m.querySelector(".modal-title");
        const bodyP = m.querySelector(".modal-body p");
        if (titleEl) titleEl.textContent = "Xoá khoản chi?";
        if (bodyP) bodyP.textContent = "Hành động này không thể hoàn tác.";
        new bootstrap.Modal(m).show();
      } else {
        if (confirm("Xoá khoản chi này?")) await doDeleteExpense();
      }
    }
  });

document.getElementById("monthFilter")?.addEventListener("change", async () => {
  // Mỗi lần đổi tháng ở trang Chi tiêu -> sync qua thu nhập
  syncIncomeMonthFilterFromGlobal();

  if (_currentUser) await refreshAll(_currentUser.uid);
  updateDashboardMonthBadge?.();
});

document
  .getElementById("incomeMonthFilter")
  ?.addEventListener("change", async () => {
    const incomeSel = document.getElementById("incomeMonthFilter");
    const globalSel = document.getElementById("monthFilter");

    // Đồng bộ ngược lại: chọn tháng ở Tài khoản thì Chi tiêu cũng đổi theo
    if (incomeSel && globalSel && globalSel.value !== incomeSel.value) {
      globalSel.value = incomeSel.value;
    }

    if (_currentUser) await refreshAll(_currentUser.uid);
    updateDashboardMonthBadge?.();
  });

const catFilterEl = document.getElementById("filterCategory");
catFilterEl?.addEventListener("change", () => {
  _expenseFilters = applyExpenseFiltersAndRender(_allExpenses, _expenseFilters);
});

const accFilterEl = document.getElementById("filterAccount");
accFilterEl?.addEventListener("change", () => {
  _expenseFilters = applyExpenseFiltersAndRender(_allExpenses, _expenseFilters);
});

const searchFilterEl = document.getElementById("filterSearch");
searchFilterEl?.addEventListener("input", () => {
  _expenseFilters = applyExpenseFiltersAndRender(_allExpenses, _expenseFilters);
});

document.getElementById("btnAddIncome")?.addEventListener("click", async () => {
  const { auth } = await import("./auth.js");
  const user = auth.currentUser;
  if (!user) return showToast("Vui lòng đăng nhập trước", "error");

  const payload = {
    name: document.getElementById("iName")?.value.trim(),
    amount: document.getElementById("iAmount")?.value,
    date: document.getElementById("iDate")?.value,
    account: document.getElementById("iAccount")?.value,
    note: document.getElementById("iNote")?.value?.trim(),
  };

  try {
    await addIncome(user.uid, payload);

    // reset + đóng modal
    document.getElementById("iName").value = "";
    document.getElementById("iAmount").value = "";
    document.getElementById("iNote").value = "";
    bootstrap.Modal.getInstance(
      document.getElementById("addIncomeModal")
    )?.hide();

    await refreshExpenses(user.uid);
    await refreshIncomes(user.uid);
    await refreshBalances(user.uid);

    showToast("Đã thêm thu nhập!");
  } catch (err) {
    console.error(err);
    showToast("Thêm thu nhập thất bại: " + (err.message || err), "error");
  }
});

// Thêm tài khoản (delegation để luôn hoạt động dù modal render sau)
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("#btnAddAccount");
  if (!btn) return;

  const { auth } = await import("./auth.js");
  const user = auth.currentUser;
  if (!user) return showToast("Vui lòng đăng nhập trước", "error");

  const name = (document.getElementById("aName")?.value || "").trim();
  const type = document.getElementById("aType")?.value || "bank";
  const isDefault = !!document.getElementById("aDefault")?.checked;

  try {
    if (!name) throw new Error("Vui lòng nhập tên tài khoản");

    // OPTIONAL: chặn trùng tên ngay trên client
    if (
      Array.isArray(_accounts) &&
      _accounts.some((a) => (a.name || "").toLowerCase() === name.toLowerCase())
    ) {
      throw new Error("Tên tài khoản đã tồn tại");
    }

    const { addAccount } = await import("./db.js");
    await addAccount(user.uid, { name, type, isDefault });

    // reset + đóng modal
    document.getElementById("aName").value = "";
    document.getElementById("aType").value = "bank";
    document.getElementById("aDefault").checked = false;
    bootstrap.Modal.getInstance(
      document.getElementById("addAccountModal")
    )?.hide();

    // load lại danh sách + fill vào các select (bao gồm chuyển tiền)
    await loadAccountsAndFill(user.uid);
    // nếu có modal chuyển tiền thì đảm bảo from/to khác nhau
    const tfFrom = document.getElementById("tfFrom");
    const tfTo = document.getElementById("tfTo");
    if (
      tfFrom &&
      tfTo &&
      tfFrom.value === tfTo.value &&
      tfTo.options.length > 1
    ) {
      tfTo.value = tfTo.options[1].value;
    }

    if (typeof showToast === "function") showToast("Đã thêm tài khoản!");
  } catch (err) {
    console.error("[AddAccount]", err);
    showToast("Không thể thêm tài khoản: " + (err.message || err), "error");
  }
});

// Delegation cho bảng tài khoản
document
  .querySelector("#accountsTable tbody")
  ?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    const id = tr?.dataset?.id;

    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user || !id) return;

    // mở modal Sửa
    if (
      btn.textContent?.trim() === "Sửa" ||
      btn.classList.contains("btn-account-edit")
    ) {
      const tds = tr.querySelectorAll("td");
      const name = tds[0]?.textContent?.trim() || "";
      const type = (tds[1]?.textContent?.trim() || "bank").toLowerCase();

      document.getElementById("eaId").value = id;
      document.getElementById("eaName").value = name;
      document.getElementById("eaType").value = [
        "bank",
        "ewallet",
        "other",
      ].includes(type)
        ? type
        : "bank";
      document.getElementById("eaDefault").checked =
        tr.querySelector(".badge.text-bg-primary") !== null;

      new bootstrap.Modal(document.getElementById("editAccountModal")).show();
    }

    // mở modal Xoá (chuyển giao)
    if (
      btn.textContent?.trim() === "Xoá" ||
      btn.classList.contains("btn-account-del")
    ) {
      document.getElementById("daId").value = id;

      // fill danh sách tài khoản khác vào #daTarget
      const sel = document.getElementById("daTarget");
      sel.innerHTML = _accounts
        .filter((a) => a.id !== id)
        .map((a) => `<option value="${a.name}">${a.name}</option>`)
        .join("");
      new bootstrap.Modal(document.getElementById("deleteAccountModal")).show();
    }
  });

document
  .getElementById("btnSaveAccount")
  ?.addEventListener("click", async () => {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return;

    const id = document.getElementById("eaId").value;
    const name = document.getElementById("eaName").value.trim();
    const type = document.getElementById("eaType").value;
    const isDefault = document.getElementById("eaDefault").checked;

    try {
      if (!name) throw new Error("Vui lòng nhập tên tài khoản");
      await updateAccount(user.uid, id, { name, type, isDefault });
      bootstrap.Modal.getInstance(
        document.getElementById("editAccountModal")
      )?.hide();

      await loadAccountsAndFill(user.uid);
      await refreshBalances(user.uid); // số dư theo tên mới
      showToast?.("Đã cập nhật tài khoản!");
    } catch (err) {
      console.error(err);
      showToast(
        "Không thể cập nhật tài khoản: " + (err.message || err),
        "error"
      );
    }
  });

document
  .getElementById("btnConfirmDeleteAccount")
  ?.addEventListener("click", async () => {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return;

    const id = document.getElementById("daId").value;
    const targetName = document.getElementById("daTarget").value;

    try {
      await deleteAccountWithReassign(user.uid, id, targetName);
      bootstrap.Modal.getInstance(
        document.getElementById("deleteAccountModal")
      )?.hide();

      await loadAccountsAndFill(user.uid); // refresh bảng + mọi dropdown
      await refreshIncomes(user.uid);
      await refreshExpenses(user.uid);
      await refreshBalances(user.uid);
      showToast?.("Đã chuyển & xoá tài khoản!");
    } catch (err) {
      console.error(err);
      showToast("Không thể xóa tài khoản: " + (err.message || err), "error");
    }
  });

document.getElementById("btnExportCsv")?.addEventListener("click", async () => {
  const { auth } = await import("./auth.js");
  const user = auth.currentUser;
  if (!user) return showToast("Vui lòng đăng nhập trước", "error");

  try {
    await exportCsvCurrentMonth(user.uid);
  } catch (err) {
    console.error(err);
    showToast("Xuất CSV thất bại: " + (err.message || err), "error");
  }
});

/**********************************************
 *  Sửa / Xoá Thu nhập
 **********************************************/
document
  .querySelector("#incomesTable tbody")
  ?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    const id = tr?.dataset?.id;
    if (!id) return;

    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    // Nếu click "Sửa"
    if (btn.classList.contains("btn-income-edit")) {
      // lấy dữ liệu chính xác từ Firestore
      const income = await getIncome(user.uid, id);
      if (!income) {
        return showToast("Không tìm thấy bản ghi thu nhập", "error");
      }

      // đổ option tài khoản trước rồi mới set value
      if (typeof fillAccountSelect === "function") {
        fillAccountSelect(document.getElementById("eiAccount"), _accounts);
      }

      // convert Timestamp -> yyyy-mm-dd
      let ymd = "";
      if (income.date) {
        const d = income.date.seconds
          ? new Date(income.date.seconds * 1000)
          : income.date.toDate
          ? income.date.toDate()
          : new Date(income.date);
        if (d instanceof Date && !isNaN(d)) ymd = d.toISOString().slice(0, 10);
      }

      // gán vào form
      document.getElementById("eiId").value = income.id;
      document.getElementById("eiName").value = income.name || "";
      document.getElementById("eiAmount").value = Number(income.amount || 0);
      document.getElementById("eiDate").value = ymd; // đã chuyển đúng định dạng
      document.getElementById("eiAccount").value = income.account || "";

      // nếu tài khoản cũ chưa có trong list (trường hợp hiếm), thêm tạm rồi chọn
      const sel = document.getElementById("eiAccount");
      if (
        income.account &&
        !Array.from(sel.options).some((o) => o.value === income.account)
      ) {
        const opt = new Option(income.account, income.account, true, true);
        sel.add(opt);
      }

      document.getElementById("eiNote").value = income.note || "";

      // mở modal sau khi đã điền xong
      new bootstrap.Modal(document.getElementById("editIncomeModal")).show();
    }

    // Nếu click "Xoá"
    if (btn.classList.contains("btn-income-del")) {
      _pendingDeleteIncomeId = id;
      _pendingDeleteId = null; // clear phía chi

      const m = document.getElementById("confirmDeleteModal");
      if (m) {
        const titleEl = m.querySelector(".modal-title");
        const bodyP = m.querySelector(".modal-body p");
        if (titleEl) titleEl.textContent = "Xoá khoản thu?";
        if (bodyP) bodyP.textContent = "Hành động này không thể hoàn tác.";
        new bootstrap.Modal(m).show();
      } else {
        // fallback hiếm gặp nếu thiếu modal
        if (confirm("Bạn có chắc muốn xoá khoản thu nhập này?")) {
          await doDeleteIncome();
        }
      }
    }
  });

document
  .getElementById("btnSaveIncome")
  ?.addEventListener("click", async () => {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    const id = document.getElementById("eiId").value;
    const payload = {
      name: document.getElementById("eiName").value.trim(),
      amount: document.getElementById("eiAmount").value,
      date: document.getElementById("eiDate").value, // có thể rỗng -> không update
      account: document.getElementById("eiAccount").value,
      note: document.getElementById("eiNote").value.trim(),
    };

    await updateIncome(user.uid, id, payload);
    bootstrap.Modal.getInstance(
      document.getElementById("editIncomeModal")
    ).hide();
    await refreshIncomes(user.uid);
    await refreshBalances(user.uid);
    showToast("Đã cập nhật thu nhập!");
  });

document
  .getElementById("btnDoTransfer")
  ?.addEventListener("click", async () => {
    const { auth } = await import("./auth.js");
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    const from = document.getElementById("tfFrom").value;
    const to = document.getElementById("tfTo").value;
    const amount = Number(document.getElementById("tfAmount").value || 0);
    const date = document.getElementById("tfDate").value;
    const note = document.getElementById("tfNote").value.trim();

    try {
      if (from === to)
        throw new Error("Tài khoản nguồn và đích phải khác nhau");
      if (amount <= 0) throw new Error("Số tiền phải > 0");

      await addTransfer(user.uid, { from, to, amount, date, note });

      // reset + đóng modal
      document.getElementById("tfAmount").value = "";
      document.getElementById("tfNote").value = "";
      bootstrap.Modal.getInstance(
        document.getElementById("transferModal")
      )?.hide();

      // cập nhật số dư trên Dashboard + nav
      await refreshBalances(user.uid);
      // (Không cần refreshExpenses/refreshIncomes vì transfer không ảnh hưởng hai bảng này)

      if (typeof showToast === "function") showToast("Chuyển tiền thành công!");
    } catch (err) {
      console.error(err);
      showToast("Không thể chuyển tiền: " + (err.message || err), "error");
    }
  });

document.getElementById("btnApplyReport")?.addEventListener("click", () => {
  const acc = getReportAccountFilter();
  _reportFilters.account = acc;

  if (_currentUser) {
    renderReportsCharts(_currentUser.uid, acc);
    renderReportInsights(_currentUser.uid, acc);
  }
});

const eNameInput = document.getElementById("eName");
if (eNameInput) {
  let aiTimer = null;

  eNameInput.addEventListener("input", () => {
    clearTimeout(aiTimer);
    const name = eNameInput.value.trim();
    const note = document.getElementById("eNote")?.value.trim() || "";

    if (!name) return;

    // Đợi user dừng gõ 0.7s rồi mới gọi AI để tránh spam
    aiTimer = setTimeout(() => {
      suggestCategoryByAI(name, note);
    }, 500);
  });
}

document
  .getElementById("incomeAccountFilter")
  ?.addEventListener("change", () => applyIncomeFiltersAndRender());

document
  .getElementById("incomeSearch")
  ?.addEventListener("input", () => applyIncomeFiltersAndRender());

/* =========================
 * 7) HOOKS PHỤ (nếu trang mở thẳng tab #accounts thì vẫn render)
 * ========================= */
window.addEventListener("hashchange", async () => {
  if (_currentUser && location.hash === "#accounts") {
    // đảm bảo bảng tài khoản & bảng thu nhập luôn có dữ liệu khi vào tab
    await loadAccountsAndFill(_currentUser.uid);
    await refreshIncomes(_currentUser.uid);
  }
});

// Nếu load trang đang ở #accounts thì refresh một lần
if (location.hash === "#accounts" && _currentUser) {
  (async () => {
    await loadAccountsAndFill(_currentUser.uid);
    await refreshIncomes(_currentUser.uid);
  })();
}

// Đảm bảo modal luôn center tuyệt đối kể cả khi có layout flex bên ngoài
document.addEventListener("show.bs.modal", (e) => {
  const modal = e.target;
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
});
