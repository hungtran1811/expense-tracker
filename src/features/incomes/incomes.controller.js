import {
  populateIncomeFilterOptions,
  applyIncomeFiltersAndRender,
} from "./incomes.filters.js";
import { listIncomesByMonth } from "../../services/firebase/firestore.js";
import { getMonthValue } from "../../shared/ui/core.js";

export async function refreshIncomesFeature(uid, filters = {}) {
  const ym = getMonthValue();
  const list = await listIncomesByMonth(uid, ym);
  populateIncomeFilterOptions(list);
  const nextFilters = applyIncomeFiltersAndRender(list, filters);
  return { list, filters: nextFilters };
}
