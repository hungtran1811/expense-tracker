import {
  populateExpenseFiltersOptions,
  applyExpenseFiltersAndRender,
} from "./expenses.filters.js";
import { listExpensesByMonth } from "../../services/firebase/firestore.js";
import { getMonthValue } from "../../shared/ui/core.js";

export async function refreshExpensesFeature(uid, filters = {}) {
  const ym = getMonthValue();
  const list = await listExpensesByMonth(uid, ym);
  populateExpenseFiltersOptions(list);
  const nextFilters = applyExpenseFiltersAndRender(list, filters);
  return { list, filters: nextFilters };
}
