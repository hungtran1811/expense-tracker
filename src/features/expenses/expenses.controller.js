import {
  populateExpenseFiltersOptions,
  applyExpenseFiltersAndRender,
} from "./expenses.filters.js";
import { listExpensesByMonth } from "../../services/firebase/firestore.js";
import { getMonthValue } from "../../shared/ui/core.js";

function setSelectValue(id, value, fallback = "all") {
  const el = document.getElementById(id);
  if (!el) return;

  const target = String(value || fallback);
  if ([...el.options].some((option) => option.value === target)) {
    el.value = target;
    return;
  }
  el.value = fallback;
}

function setInputValue(id, value = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(value || "");
}

export async function refreshExpensesFeature(uid, filters = {}) {
  const ym = getMonthValue();
  const list = await listExpensesByMonth(uid, ym);
  populateExpenseFiltersOptions(list);

  setSelectValue("filterCategory", filters?.category, "all");
  setSelectValue("filterAccount", filters?.account, "all");
  setInputValue("filterSearch", filters?.search || "");

  const nextFilters = applyExpenseFiltersAndRender(list, filters);
  return { list, filters: nextFilters };
}
