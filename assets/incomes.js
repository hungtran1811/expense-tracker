// assets/incomes.js
// Xử lý phần RENDER & TÍNH TỔNG thu nhập theo tháng

import { renderIncomesTable } from "./ui.js";

/**
 * Render bảng thu nhập + trả về tổng số tiền thu trong list.
 * - list: mảng income đã load theo tháng (listIncomesByMonth)
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
