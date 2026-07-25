import { formatCurrency, formatDateLabel } from "../finance/finance.controller.js";
import { getFinanceCategoryLabel, getTransactionTypeLabel } from "../../shared/constants/finance.constants.js";
import { t } from "../../shared/constants/copy.vi.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function collectTransactions({ transactions = [], transactionsByMonth = {}, loanTransactions = [] } = {}) {
  const map = new Map();
  const push = (item) => {
    const id = String(item?.id || "").trim();
    if (!id || map.has(id)) return;
    map.set(id, item);
  };
  (Array.isArray(transactions) ? transactions : []).forEach(push);
  Object.values(transactionsByMonth || {}).forEach((items) => {
    (Array.isArray(items) ? items : []).forEach(push);
  });
  (Array.isArray(loanTransactions) ? loanTransactions : []).forEach(push);
  return Array.from(map.values());
}

function matchesQuery(haystack = "", query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return false;
  return String(haystack || "").toLowerCase().includes(q);
}

function amountMatches(amount, query) {
  const q = String(query || "").trim().replaceAll(/\s/g, "");
  if (!q) return false;
  const digits = q.replaceAll(/[^\d]/g, "");
  if (!digits) return false;
  const value = Math.abs(Number(amount || 0));
  if (!Number.isFinite(value)) return false;
  return String(Math.round(value)).includes(digits) || formatCurrency(value).replaceAll(/\s/g, "").includes(q);
}

export function buildGlobalSearchResults({
  query = "",
  transactions = [],
  transactionsByMonth = {},
  loanTransactions = [],
  loanParties = [],
  accounts = [],
  limit = 24,
} = {}) {
  const q = String(query || "").trim();
  if (!q) return [];

  const accountMap = new Map(
    (Array.isArray(accounts) ? accounts : []).map((item) => [String(item?.id || "").trim(), item])
  );
  const partyMap = new Map(
    (Array.isArray(loanParties) ? loanParties : []).map((item) => [String(item?.id || "").trim(), item])
  );
  const results = [];

  (Array.isArray(loanParties) ? loanParties : []).forEach((party) => {
    const name = String(party?.name || "").trim();
    const note = String(party?.note || "").trim();
    if (!matchesQuery(name, q) && !matchesQuery(note, q)) return;
    results.push({
      kind: "loan_party",
      id: String(party?.id || "").trim(),
      title: name || t("search.unnamedParty", "Người mượn"),
      meta: note || t("search.loanPartyMeta", "Cho mượn"),
      amountText: "",
    });
  });

  collectTransactions({ transactions, transactionsByMonth, loanTransactions }).forEach((tx) => {
    const type = String(tx?.type || "").trim();
    const note = String(tx?.note || "").trim();
    const amount = Number(tx?.amount || 0);
    const accountName = String(accountMap.get(String(tx?.accountId || "").trim())?.name || "").trim();
    const partyName = String(partyMap.get(String(tx?.loanPartyId || "").trim())?.name || "").trim();
    const categoryLabel = type === "expense" ? getFinanceCategoryLabel(tx?.categoryKey) : "";
    const haystack = [note, accountName, partyName, categoryLabel, getTransactionTypeLabel(type)].join(" ");

    if (!matchesQuery(haystack, q) && !amountMatches(amount, q)) return;

    const isLoan = type === "loan_lend" || type === "loan_repay";
    results.push({
      kind: isLoan ? "loan_tx" : "transaction",
      id: String(tx?.id || "").trim(),
      type,
      partyId: String(tx?.loanPartyId || "").trim(),
      title: note || partyName || getTransactionTypeLabel(type),
      meta: [getTransactionTypeLabel(type), accountName || partyName, formatDateLabel(tx?.occurredAt)]
        .filter(Boolean)
        .join(" · "),
      amountText: formatCurrency(Math.abs(amount)),
      amountClass: type === "income" || type === "loan_repay" ? "income" : "expense",
      sortMs: toDate(tx?.occurredAt)?.getTime() || 0,
    });
  });

  return results
    .sort((a, b) => Number(b.sortMs || 0) - Number(a.sortMs || 0))
    .slice(0, Math.max(1, Number(limit || 24)));
}

export function renderGlobalSearchResults(container, results = [], query = "") {
  if (!container) return;
  const q = String(query || "").trim();
  const items = Array.isArray(results) ? results : [];

  if (!q) {
    container.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(t("search.emptyPromptTitle", "Tìm nhanh"))}</strong>
        <div>${escapeHtml(
          t("search.emptyPromptBody", "Gõ ghi chú, tên người mượn hoặc số tiền. Phím / để mở tìm kiếm.")
        )}</div>
      </div>
    `;
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(t("search.noResultsTitle", "Không có kết quả"))}</strong>
        <div>${escapeHtml(t("search.noResultsBody", "Thử từ khóa khác hoặc số tiền gần đúng."))}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="global-search-list" role="listbox">
      ${items
        .map(
          (item) => `
            <button
              type="button"
              class="global-search-item"
              role="option"
              data-search-kind="${escapeHtml(item.kind)}"
              data-search-id="${escapeHtml(item.id)}"
              data-search-type="${escapeHtml(item.type || "")}"
              data-search-party-id="${escapeHtml(item.partyId || "")}"
            >
              <span class="global-search-main">
                <strong class="global-search-title u-ellipsis">${escapeHtml(item.title)}</strong>
                <span class="global-search-meta u-ellipsis">${escapeHtml(item.meta)}</span>
              </span>
              ${
                item.amountText
                  ? `<strong class="global-search-amount u-money ${escapeHtml(item.amountClass || "")}">${escapeHtml(
                      item.amountText
                    )}</strong>`
                  : ""
              }
            </button>
          `
        )
        .join("")}
    </div>
  `;
}
