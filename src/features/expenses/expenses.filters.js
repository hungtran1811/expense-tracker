import { renderExpensesTable } from "../../shared/ui/tables.js";
import { formatVND } from "../../shared/ui/core.js";
import { toCategoryLabelVi, toCategoryValueDb } from "../../shared/constants/categoryMap.vi.js";

function normalizeCategoryValue(value = "") {
  return String(toCategoryValueDb(value) || "").trim();
}

export function populateExpenseFiltersOptions(list) {
  const catSel = document.getElementById("filterCategory");
  const accSel = document.getElementById("filterAccount");
  if (!catSel && !accSel) return;

  const categoriesMap = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const normalized = normalizeCategoryValue(item?.category);
    if (!normalized) return;
    if (!categoriesMap.has(normalized)) {
      categoriesMap.set(normalized, toCategoryLabelVi(normalized));
    }
  });
  const categories = Array.from(categoriesMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "vi"));

  const accounts = [
    ...new Set((Array.isArray(list) ? list : []).map((e) => (e.account || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const prevCatRaw = catSel?.value || "all";
  const prevCat = prevCatRaw === "all" ? "all" : normalizeCategoryValue(prevCatRaw);
  const prevAcc = accSel?.value || "all";

  if (catSel) {
    catSel.innerHTML =
      '<option value="all">Tất cả danh mục</option>' +
      categories.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
    if ([...catSel.options].some((o) => o.value === prevCat)) catSel.value = prevCat;
  }

  if (accSel) {
    accSel.innerHTML =
      '<option value="all">Tất cả tài khoản</option>' +
      accounts.map((a) => `<option value="${a}">${a}</option>`).join("");
    if ([...accSel.options].some((o) => o.value === prevAcc)) accSel.value = prevAcc;
  }
}

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
    const target = normalizeCategoryValue(category);
    list = list.filter((item) => normalizeCategoryValue(item?.category) === target);
  }

  if (account !== "all") {
    const target = account.toLowerCase();
    list = list.filter((e) => (e.account || "").toLowerCase() === target);
  }

  if (keyword) {
    list = list.filter((e) => {
      const name = (e.name || "").toLowerCase();
      const note = (e.note || "").toLowerCase();
      return name.includes(keyword) || note.includes(keyword);
    });
  }

  renderExpensesTable(tbody, list);

  const infoEl = document.getElementById("expenseFilterInfo");
  if (infoEl) {
    const totalFiltered = list.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const totalAll = (Array.isArray(allExpenses) ? allExpenses : []).reduce(
      (sum, x) => sum + Number(x.amount || 0),
      0
    );

    if (
      !allExpenses?.length ||
      (list.length === allExpenses.length && category === "all" && account === "all" && !keyword)
    ) {
      infoEl.textContent = `${list.length} khoản chi - ${formatVND(totalFiltered)} trong tháng này`;
    } else {
      infoEl.textContent = `${list.length}/${allExpenses.length} khoản chi - ${formatVND(totalFiltered)} (từ tổng ${formatVND(totalAll)})`;
    }
  }

  return filters;
}
