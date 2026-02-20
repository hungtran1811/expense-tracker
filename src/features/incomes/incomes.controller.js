import {
  populateIncomeFilterOptions,
  applyIncomeFiltersAndRender,
} from "./incomes.filters.js";
import { listIncomesByMonth } from "../../services/firebase/firestore.js";
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

export async function refreshIncomesFeature(uid, filters = {}) {
  const ym = getMonthValue();
  const list = await listIncomesByMonth(uid, ym);
  populateIncomeFilterOptions(list);

  setSelectValue("incomeAccountFilter", filters?.account, "all");
  setInputValue("incomeSearch", filters?.search || "");

  const nextFilters = applyIncomeFiltersAndRender(list, filters);
  return { list, filters: nextFilters };
}
