import { renderIncomesTable } from "../../shared/ui/tables.js";
import { formatVND } from "../../shared/ui/core.js";

export function renderIncomesSection(list) {
  const tbody = document.querySelector("#incomesTable tbody");
  if (tbody) {
    renderIncomesTable(tbody, Array.isArray(list) ? list : []);
  }

  return (Array.isArray(list) ? list : []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export function populateIncomeFilterOptions(list) {
  const accSel = document.getElementById("incomeAccountFilter");
  if (!accSel) return;

  const accounts = [
    ...new Set((Array.isArray(list) ? list : []).map((item) => (item.account || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  const prevAcc = accSel.value || "all";

  accSel.innerHTML =
    '<option value="all">Tất cả tài khoản</option>' +
    accounts.map((a) => `<option value="${a}">${a}</option>`).join("");

  if ([...accSel.options].some((opt) => opt.value === prevAcc)) {
    accSel.value = prevAcc;
  }
}

export function applyIncomeFiltersAndRender(allIncomes, filters = {}) {
  const accSel = document.getElementById("incomeAccountFilter");
  const searchEl = document.getElementById("incomeSearch");

  const account = accSel?.value || filters.account || "all";
  const keyword = (searchEl?.value || filters.search || "").trim().toLowerCase();

  const nextFilters = { account, search: keyword };

  let list = Array.isArray(allIncomes) ? [...allIncomes] : [];

  if (account !== "all") {
    const target = account.toLowerCase();
    list = list.filter((item) => (item.account || "").toLowerCase() === target);
  }

  if (keyword) {
    list = list.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const note = (item.note || "").toLowerCase();
      return name.includes(keyword) || note.includes(keyword);
    });
  }

  renderIncomesSection(list);

  const infoEl = document.getElementById("incomeFilterInfo");
  if (infoEl) {
    const totalFiltered = list.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const totalAll = (Array.isArray(allIncomes) ? allIncomes : []).reduce(
      (sum, x) => sum + Number(x.amount || 0),
      0
    );

    if (!totalAll || (list.length === (allIncomes?.length || 0) && account === "all" && !keyword)) {
      infoEl.textContent = `${list.length} khoản thu - ${formatVND(totalFiltered)} trong tháng này`;
    } else {
      infoEl.textContent = `${list.length}/${allIncomes.length} khoản thu - ${formatVND(totalFiltered)} (từ tổng ${formatVND(totalAll)})`;
    }
  }

  return nextFilters;
}
