// assets/expenses.js
// Chỉ xử lý phần LỌC + RENDER bảng chi tiêu

import { renderExpensesTable } from "./ui.js";
import { formatVND } from "./core.js";

/**
 * Đổ lại options cho 2 bộ lọc: danh mục + tài khoản
 * Dùng trực tiếp DOM giống main.js trước đây
 */
export function populateExpenseFiltersOptions(list) {
  const catSel = document.getElementById("filterCategory");
  const accSel = document.getElementById("filterAccount");
  if (!catSel && !accSel) return;

  const categories = [
    ...new Set(list.map((e) => (e.category || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const accounts = [
    ...new Set(list.map((e) => (e.account || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const prevCat = catSel?.value || "all";
  const prevAcc = accSel?.value || "all";

  if (catSel) {
    catSel.innerHTML =
      '<option value="all">Tất cả danh mục</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    if ([...catSel.options].some((o) => o.value === prevCat)) {
      catSel.value = prevCat;
    }
  }

  if (accSel) {
    accSel.innerHTML =
      '<option value="all">Tất cả tài khoản</option>' +
      accounts.map((a) => `<option value="${a}">${a}</option>`).join("");
    if ([...accSel.options].some((o) => o.value === prevAcc)) {
      accSel.value = prevAcc;
    }
  }
}

/**
 * Lọc dữ liệu chi tiêu + render bảng
 * - Nhận vào: danh sách chi tiêu thô (allExpenses) + filters hiện tại
 * - Đọc lại giá trị filter từ DOM
 * - Trả về filters mới để main.js lưu lại
 */
export function applyExpenseFiltersAndRender(allExpenses, currentFilters = {}) {
  const tbody = document.querySelector("#expensesTable tbody");
  if (!tbody) return currentFilters;

  const catSel = document.getElementById("filterCategory");
  const accSel = document.getElementById("filterAccount");
  const searchEl = document.getElementById("filterSearch");

  const category = catSel?.value || "all";
  const account = accSel?.value || "all";
  const keyword = (searchEl?.value || "").trim().toLowerCase();

  const filters = { ...currentFilters, category, account, search: keyword };

  let list = Array.isArray(allExpenses) ? [...allExpenses] : [];

  if (category !== "all") {
    const c = category.toLowerCase();
    list = list.filter((e) => (e.category || "").toLowerCase() === c);
  }

  if (account !== "all") {
    const a = account.toLowerCase();
    list = list.filter((e) => (e.account || "").toLowerCase() === a);
  }

  if (keyword) {
    list = list.filter((e) => {
      const name = (e.name || "").toLowerCase();
      const note = (e.note || "").toLowerCase();
      return name.includes(keyword) || note.includes(keyword);
    });
  }

  // Render bảng
  renderExpensesTable(tbody, list);

  // Cập nhật label info nhỏ dưới filter
  const infoEl = document.getElementById("expenseFilterInfo");
  if (infoEl) {
    const totalFiltered = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalAll = (allExpenses || []).reduce(
      (s, x) => s + Number(x.amount || 0),
      0
    );

    if (
      !allExpenses?.length ||
      (list.length === allExpenses.length &&
        category === "all" &&
        account === "all" &&
        !keyword)
    ) {
      // Trường hợp không lọc gì
      infoEl.textContent = `${list.length} khoản chi • ${formatVND(
        totalFiltered
      )} trong tháng này`;
    } else {
      // Đang áp dụng filter
      infoEl.textContent = `${list.length}/${
        allExpenses.length
      } khoản chi • ${formatVND(totalFiltered)} (từ tổng ${formatVND(
        totalAll
      )})`;
    }
  }

  return filters;
}
