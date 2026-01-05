// assets/incomes.js
// Chỉ xử lý phần LỌC + RENDER bảng thu nhập

import { renderIncomesTable } from "./ui.js";
import { formatVND } from "./core.js";

/**
 * Render bảng thu nhập + trả về tổng số tiền thu trong list (đã lọc).
 * - list: mảng income đã qua filter
 * - return: tổng thu (number)
 */
export function renderIncomesSection(list) {
  const tbody = document.querySelector("#incomesTable tbody");
  if (tbody && typeof renderIncomesTable === "function") {
    renderIncomesTable(tbody, Array.isArray(list) ? list : []);
  }

  const total = (Array.isArray(list) ? list : []).reduce(
    (s, i) => s + Number(i.amount || 0),
    0
  );

  return total;
}

/**
 * Đổ lại options cho filter tài khoản thu nhập (#incomeAccountFilter).
 * Dùng list thu nhập của THÁNG hiện tại.
 */
export function populateIncomeFilterOptions(list) {
  const accSel = document.getElementById("incomeAccountFilter");
  if (!accSel) return;

  const accounts = [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .map((i) => (i.account || "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const prevAcc = accSel.value || "all";

  accSel.innerHTML =
    '<option value="all">Tất cả tài khoản</option>' +
    accounts.map((a) => `<option value="${a}">${a}</option>`).join("");

  if ([...accSel.options].some((o) => o.value === prevAcc)) {
    accSel.value = prevAcc;
  }
}

/**
 * Áp dụng filter account + search rồi render lại bảng.
 * - allIncomes: toàn bộ list thu nhập của tháng đang chọn
 * - filters: object { account, search }
 * → return filters mới (để main.js lưu lại)
 */
export function applyIncomeFiltersAndRender(allIncomes, filters = {}) {
  const accSel = document.getElementById("incomeAccountFilter");
  const searchEl = document.getElementById("incomeSearch");

  const account = accSel?.value || filters.account || "all";
  const keyword = (searchEl?.value || filters.search || "")
    .trim()
    .toLowerCase();

  const nextFilters = { account, search: keyword };

  let list = Array.isArray(allIncomes) ? [...allIncomes] : [];

  // Lọc theo tài khoản
  if (account !== "all") {
    const a = account.toLowerCase();
    list = list.filter((i) => (i.account || "").toLowerCase() === a);
  }

  // Lọc theo từ khoá tên hoặc ghi chú
  if (keyword) {
    list = list.filter((i) => {
      const name = (i.name || "").toLowerCase();
      const note = (i.note || "").toLowerCase();
      return name.includes(keyword) || note.includes(keyword);
    });
  }

  // Render lại bảng
  renderIncomesSection(list);

  // Cập nhật info nhỏ dưới bảng (nếu có)
  const infoEl = document.getElementById("incomeFilterInfo");
  if (infoEl) {
    const totalFiltered = list.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAll = (Array.isArray(allIncomes) ? allIncomes : []).reduce(
      (s, i) => s + Number(i.amount || 0),
      0
    );

    if (
      !totalAll ||
      (list.length === (allIncomes?.length || 0) &&
        account === "all" &&
        !keyword)
    ) {
      // Không dùng filter
      infoEl.textContent = `${list.length} khoản thu • ${formatVND(
        totalFiltered
      )} trong tháng này`;
    } else {
      // Đang áp dụng filter
      infoEl.textContent = `${list.length}/${
        allIncomes.length
      } khoản thu • ${formatVND(totalFiltered)} (từ tổng ${formatVND(
        totalAll
      )})`;
    }
  }

  return nextFilters;
}
