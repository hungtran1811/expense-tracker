import {
  getAccountTypeLabel,
  getFinanceCategoryLabel,
} from "../../shared/constants/finance.constants.js";
import { prevYm } from "../../shared/ui/core.js";
import {
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getCurrentYm,
  getTodayInputValue,
  toDateInputValue,
} from "../finance/finance.controller.js";

function pad(number) {
  return String(number).padStart(2, "0");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeYm(value = "") {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : getCurrentYm();
}

function sortAccountsForReport(items = []) {
  return [...items].sort((a, b) => {
    const archivedA = String(a?.status || "active") === "archived" ? 1 : 0;
    const archivedB = String(b?.status || "active") === "archived" ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    const defaultA = a?.isDefault ? -1 : 0;
    const defaultB = b?.isDefault ? -1 : 0;
    if (defaultA !== defaultB) return defaultA - defaultB;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function buildExpenseScopeMap(items = []) {
  return new Map(
    (Array.isArray(items) ? items : []).map((item) => [String(item?.id || "").trim(), String(item?.name || "").trim()])
  );
}

function isCurrentMonth(month = "") {
  return normalizeYm(month) === getCurrentYm();
}

function addDays(dateInput = "", delta = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateInput || "").trim())) return "";
  const [year, month, day] = String(dateInput).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildDateRange(fromDate = "", toDate = "") {
  const start = String(fromDate || "").trim();
  const end = String(toDate || "").trim();
  if (!start || !end) return [];

  const items = [];
  let cursor = start;
  let safety = 0;
  while (cursor && cursor <= end && safety < 370) {
    items.push(cursor);
    cursor = addDays(cursor, 1);
    safety += 1;
  }
  return items;
}

function createEmptyDailyBucket(dateKey = "") {
  return {
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    income: 0,
    expense: 0,
    adjustment: 0,
    transfer: 0,
    net: 0,
  };
}

function includesAccount(transaction, accountId = "") {
  const target = String(accountId || "").trim();
  if (!target || target === "all") return true;
  return (
    String(transaction?.accountId || "").trim() === target ||
    String(transaction?.toAccountId || "").trim() === target
  );
}

function isReportTransactionType(type = "") {
  return ["expense", "income", "transfer", "adjustment"].includes(String(type || "").trim());
}

function buildReportSummary(transactions = [], fromDate = "", toDate = "") {
  const summary = transactions.reduce(
    (acc, transaction) => {
      const type = String(transaction?.type || "").trim();
      const amount = Number(transaction?.amount || 0);
      acc.transactionCount += 1;
      if (type === "income") {
        acc.incomeTotal += Math.abs(amount);
      } else if (type === "expense") {
        acc.expenseTotal += Math.abs(amount);
      } else if (type === "transfer") {
        acc.transferTotal += Math.abs(amount);
      } else if (type === "adjustment") {
        acc.adjustmentTotal += amount;
      }
      return acc;
    },
    {
      incomeTotal: 0,
      expenseTotal: 0,
      transferTotal: 0,
      adjustmentTotal: 0,
      transactionCount: 0,
    }
  );

  const rangeLabel =
    fromDate && toDate
      ? `${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)}`
      : formatMonthLabel(getCurrentYm());

  return {
    ...summary,
    netTotal: summary.incomeTotal - summary.expenseTotal + summary.adjustmentTotal,
    rangeLabel,
    incomeTotalText: formatCurrency(summary.incomeTotal),
    expenseTotalText: formatCurrency(summary.expenseTotal),
    transferTotalText: formatCurrency(summary.transferTotal),
    netTotalText: `${summary.incomeTotal - summary.expenseTotal + summary.adjustmentTotal >= 0 ? "+" : "-"}${formatCurrency(
      Math.abs(summary.incomeTotal - summary.expenseTotal + summary.adjustmentTotal)
    )}`,
    adjustmentMetaText:
      summary.adjustmentTotal === 0
        ? "Điều chỉnh 0đ"
        : `Điều chỉnh ${summary.adjustmentTotal >= 0 ? "+" : "-"}${formatCurrency(
            Math.abs(summary.adjustmentTotal)
          )}`,
  };
}

function buildCategoryBreakdown(transactions = [], totalExpense = 0) {
  const bucket = new Map();
  transactions.forEach((transaction) => {
    if (String(transaction?.type || "").trim() !== "expense") return;
    const key = String(transaction?.categoryKey || "other").trim() || "other";
    if (!bucket.has(key)) {
      bucket.set(key, {
        key,
        label: getFinanceCategoryLabel(key),
        total: 0,
        count: 0,
      });
    }
    const item = bucket.get(key);
    item.total += Math.abs(Number(transaction?.amount || 0));
    item.count += 1;
  });

  return Array.from(bucket.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "vi"))
    .map((item) => {
      const share = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
      return {
        ...item,
        share,
        shareText: `${share.toFixed(1)}%`,
        totalText: formatCurrency(item.total),
        barWidth: `${Math.max(share, item.total > 0 ? 6 : 0)}%`,
      };
    });
}

function buildScopeBreakdown(transactions = [], expenseScopes = [], totalExpense = 0) {
  const scopeMap = buildExpenseScopeMap(expenseScopes);
  const bucket = new Map();

  transactions.forEach((transaction) => {
    if (String(transaction?.type || "").trim() !== "expense") return;
    const scopeId = String(transaction?.scopeId || "").trim() || "unknown";
    const label = scopeMap.get(scopeId) || "Chưa gắn nhóm";
    if (!bucket.has(scopeId)) {
      bucket.set(scopeId, {
        key: scopeId,
        label,
        total: 0,
        count: 0,
      });
    }
    const item = bucket.get(scopeId);
    item.total += Math.abs(Number(transaction?.amount || 0));
    item.count += 1;
  });

  return Array.from(bucket.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "vi"))
    .map((item) => {
      const share = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
      return {
        ...item,
        share,
        shareText: `${share.toFixed(1)}%`,
        totalText: formatCurrency(item.total),
        barWidth: `${Math.max(share, item.total > 0 ? 6 : 0)}%`,
      };
    });
}

function buildReportBalanceSnapshot(accounts = [], selectedAccountId = "all") {
  const sortedAccounts = sortAccountsForReport(accounts);
  const selectedId = String(selectedAccountId || "all").trim();
  const visibleAccounts =
    selectedId !== "all"
      ? sortedAccounts.filter((account) => String(account?.id || "").trim() === selectedId)
      : sortedAccounts.filter((account) => String(account?.status || "active") !== "archived");

  const totalBalance = visibleAccounts.reduce((sum, account) => sum + Number(account?.currentBalance || 0), 0);
  return {
    totalBalance,
    totalBalanceText: formatCurrency(totalBalance),
    items: visibleAccounts.slice(0, 4).map((account) => ({
      id: String(account?.id || "").trim(),
      name: String(account?.name || "").trim(),
      balanceText: formatCurrency(account?.currentBalance || 0),
      metaText: account?.isDefault ? "Mặc định" : getAccountTypeLabel(account?.type),
      isDefault: !!account?.isDefault,
    })),
  };
}

function buildLargestExpenseHighlight(transactions = [], accounts = [], expenseScopes = []) {
  const accountMap = new Map(
    (Array.isArray(accounts) ? accounts : []).map((account) => [String(account?.id || "").trim(), account])
  );
  const scopeMap = buildExpenseScopeMap(expenseScopes);
  const current = [...(Array.isArray(transactions) ? transactions : [])]
    .filter((item) => String(item?.type || "").trim() === "expense")
    .sort((a, b) => Math.abs(Number(b?.amount || 0)) - Math.abs(Number(a?.amount || 0)))[0];

  if (!current) return null;

  return {
    title: getFinanceCategoryLabel(current?.categoryKey),
    amountText: formatCurrency(Math.abs(Number(current?.amount || 0))),
    dateLabel: formatDateLabel(current?.occurredAt),
    accountLabel: String(accountMap.get(String(current?.accountId || "").trim())?.name || "Không rõ").trim(),
    scopeLabel: String(scopeMap.get(String(current?.scopeId || "").trim()) || "Chưa gắn nhóm").trim(),
    note: String(current?.note || "").trim(),
  };
}

function buildQuickSignals({
  scopeItems = [],
  categoryItems = [],
  accountItems = [],
} = {}) {
  const topScope = scopeItems[0] || null;
  const topCategory = categoryItems[0] || null;
  const topOutflowAccount = [...(Array.isArray(accountItems) ? accountItems : [])]
    .filter((item) => Number(item?.outflow || 0) > 0)
    .sort(
      (a, b) =>
        Number(b?.outflow || 0) - Number(a?.outflow || 0) ||
        String(a?.name || "").localeCompare(String(b?.name || ""), "vi")
    )[0];

  return [
    topScope
      ? {
          label: "Nhóm chi nhiều nhất",
          valueText: topScope.label,
          note: `${topScope.shareText} tổng chi.`,
          tone: "brand",
        }
      : null,
    topCategory
      ? {
          label: "Danh mục lớn nhất",
          valueText: topCategory.label,
          note: `${topCategory.shareText} tổng chi.`,
          tone: "success",
        }
      : null,
    topOutflowAccount
      ? {
          label: "Ví chi nhiều nhất",
          valueText: topOutflowAccount.name,
          note: `${formatCurrency(topOutflowAccount.outflow)} chi ra.`,
          tone: "neutral",
        }
      : null,
  ].filter(Boolean);
}

function buildAttentionItems({
  scopeItems = [],
  categoryItems = [],
  accountItems = [],
  largestExpense = null,
} = {}) {
  const items = [];
  const topOutflowAccount = [...(Array.isArray(accountItems) ? accountItems : [])]
    .filter((item) => Number(item?.outflow || 0) > 0)
    .sort(
      (a, b) =>
        Number(b?.outflow || 0) - Number(a?.outflow || 0) ||
        String(a?.name || "").localeCompare(String(b?.name || ""), "vi")
    )[0];

  if (scopeItems[0]) {
    items.push(`${scopeItems[0].label} chiếm ${scopeItems[0].shareText} tổng chi.`);
  }
  if (categoryItems[0]) {
    items.push(`${categoryItems[0].label} là danh mục chi lớn nhất.`);
  }
  if (topOutflowAccount) {
    items.push(`${topOutflowAccount.name} chi ra nhiều nhất.`);
  }
  if (largestExpense) {
    items.push(`Khoản lớn nhất: ${largestExpense.title.toLowerCase()} ${largestExpense.amountText}.`);
  }

  return Array.from(new Set(items)).slice(0, 5);
}

function buildAccountBreakdown(transactions = [], accounts = [], selectedAccountId = "all") {
  const accountMap = new Map(
    sortAccountsForReport(accounts).map((account) => [String(account?.id || "").trim(), account])
  );
  const totals = new Map();

  function ensureAccount(id = "") {
    const accountId = String(id || "").trim();
    if (!accountId || !accountMap.has(accountId)) return null;
    if (!totals.has(accountId)) {
      totals.set(accountId, {
        accountId,
        inflow: 0,
        outflow: 0,
      });
    }
    return totals.get(accountId);
  }

  transactions.forEach((transaction) => {
    const type = String(transaction?.type || "").trim();
    const amount = Math.abs(Number(transaction?.amount || 0));
    const signedAmount = Number(transaction?.amount || 0);
    const fromAccount = ensureAccount(transaction?.accountId);
    const toAccount = ensureAccount(transaction?.toAccountId);

    if (type === "expense" && fromAccount) {
      fromAccount.outflow += amount;
    } else if (type === "income" && fromAccount) {
      fromAccount.inflow += amount;
    } else if (type === "transfer") {
      if (fromAccount) fromAccount.outflow += amount;
      if (toAccount) toAccount.inflow += amount;
    } else if (type === "adjustment" && fromAccount) {
      if (signedAmount >= 0) fromAccount.inflow += signedAmount;
      else fromAccount.outflow += Math.abs(signedAmount);
    }
  });

  const selectedId = String(selectedAccountId || "all").trim();
  if (selectedId !== "all" && accountMap.has(selectedId) && !totals.has(selectedId)) {
    totals.set(selectedId, {
      accountId: selectedId,
      inflow: 0,
      outflow: 0,
    });
  }

  return Array.from(totals.values())
    .map((item) => {
      const account = accountMap.get(item.accountId) || {};
      const net = item.inflow - item.outflow;
      return {
        accountId: item.accountId,
        name: String(account?.name || "Không rõ"),
        typeLabel: getAccountTypeLabel(account?.type),
        isArchived: String(account?.status || "active") === "archived",
        inflow: item.inflow,
        outflow: item.outflow,
        net,
        currentBalance: Number(account?.currentBalance || 0),
        inflowText: formatCurrency(item.inflow),
        outflowText: formatCurrency(item.outflow),
        netText: `${net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}`,
        currentBalanceText: formatCurrency(account?.currentBalance || 0),
      };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name, "vi"));
}

export function buildDailyFlow(transactions = [], fromDate = "", toDate = "") {
  const keys = buildDateRange(fromDate, toDate);
  const dailyMap = new Map(keys.map((dateKey) => [dateKey, createEmptyDailyBucket(dateKey)]));

  transactions.forEach((transaction) => {
    const dateKey = toDateInputValue(transaction?.occurredAt);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, createEmptyDailyBucket(dateKey));
    }
    const item = dailyMap.get(dateKey);
    const type = String(transaction?.type || "").trim();
    const amount = Number(transaction?.amount || 0);

    if (type === "income") {
      item.income += Math.abs(amount);
    } else if (type === "expense") {
      item.expense += Math.abs(amount);
    } else if (type === "transfer") {
      item.transfer += Math.abs(amount);
    } else if (type === "adjustment") {
      item.adjustment += amount;
    }
    item.net = item.income - item.expense + item.adjustment;
  });

  const items = Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const maxValue = items.reduce((acc, item) => {
    return Math.max(acc, item.income, item.expense, Math.abs(item.net));
  }, 0);
  const safeMax = maxValue || 1;

  return {
    maxValue: safeMax,
    items: items.map((item) => ({
      ...item,
      incomeText: formatCurrency(item.income),
      expenseText: formatCurrency(item.expense),
      transferText: formatCurrency(item.transfer),
      netText: `${item.net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(item.net))}`,
      incomeWidth: `${(item.income / safeMax) * 100}%`,
      expenseWidth: `${(item.expense / safeMax) * 100}%`,
      netWidth: `${(Math.abs(item.net) / safeMax) * 100}%`,
      netClass: item.net >= 0 ? "positive" : "negative",
    })),
  };
}

function buildAccountFilterOptions(accounts = [], transactions = [], selectedAccountId = "all") {
  const involvedIds = new Set();
  transactions.forEach((transaction) => {
    const accountId = String(transaction?.accountId || "").trim();
    const toAccountId = String(transaction?.toAccountId || "").trim();
    if (accountId) involvedIds.add(accountId);
    if (toAccountId) involvedIds.add(toAccountId);
  });

  const selectedId = String(selectedAccountId || "all").trim();
  if (selectedId && selectedId !== "all") {
    involvedIds.add(selectedId);
  }

  return sortAccountsForReport(accounts)
    .filter((account) => {
      const accountId = String(account?.id || "").trim();
      if (String(account?.status || "active") !== "archived") return true;
      return involvedIds.has(accountId);
    })
    .map((account) => ({
      value: account.id,
      label:
        String(account?.status || "active") === "archived"
          ? `${account.name} · Đã lưu trữ`
          : account.name,
    }));
}

export function getMonthStartDateInput(month = getCurrentYm()) {
  return `${normalizeYm(month)}-01`;
}

export function getMonthEndDateInput(month = getCurrentYm()) {
  const [year, monthValue] = normalizeYm(month).split("-").map(Number);
  const date = new Date(year, monthValue, 0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildDefaultReportFilters(month = getCurrentYm()) {
  const normalizedMonth = normalizeYm(month);
  return {
    month: normalizedMonth,
    fromDate: getMonthStartDateInput(normalizedMonth),
    toDate: isCurrentMonth(normalizedMonth)
      ? getTodayInputValue()
      : getMonthEndDateInput(normalizedMonth),
    accountId: "all",
  };
}

export function buildReportFiltersForPreset(preset = "current-month") {
  const monthKey =
    String(preset || "").trim() === "previous-month"
      ? prevYm(getCurrentYm())
      : getCurrentYm();
  return buildDefaultReportFilters(monthKey);
}

export function resolveReportPreset(filters = {}) {
  const normalized = normalizeReportFilters(filters);
  const current = buildDefaultReportFilters(getCurrentYm());
  const previous = buildDefaultReportFilters(prevYm(getCurrentYm()));

  if (
    normalized.fromDate === current.fromDate &&
    normalized.toDate === current.toDate &&
    normalized.month === current.month &&
    normalized.accountId === current.accountId
  ) {
    return "current-month";
  }

  if (
    normalized.fromDate === previous.fromDate &&
    normalized.toDate === previous.toDate &&
    normalized.month === previous.month &&
    normalized.accountId === previous.accountId
  ) {
    return "previous-month";
  }

  return "";
}

export function syncReportFiltersWithMonth(month = getCurrentYm(), currentFilters = {}) {
  const normalizedMonth = normalizeYm(month);
  return {
    ...normalizeReportFilters(currentFilters),
    month: normalizedMonth,
    fromDate: getMonthStartDateInput(normalizedMonth),
    toDate: isCurrentMonth(normalizedMonth)
      ? getTodayInputValue()
      : getMonthEndDateInput(normalizedMonth),
  };
}

export function normalizeReportFilters(filters = {}) {
  const normalizedMonth = normalizeYm(filters?.month || getYmFromDates(filters?.fromDate, filters?.toDate));
  const defaults = buildDefaultReportFilters(normalizedMonth);
  return {
    month: normalizedMonth,
    fromDate: String(filters?.fromDate || defaults.fromDate).trim() || defaults.fromDate,
    toDate: String(filters?.toDate || defaults.toDate).trim() || defaults.toDate,
    accountId: String(filters?.accountId || "all").trim() || "all",
  };
}

function getYmFromDates(fromDate = "", toDate = "") {
  const fromValue = String(fromDate || "").trim();
  const toValue = String(toDate || "").trim();
  const source = /^\d{4}-\d{2}-\d{2}$/.test(fromValue)
    ? fromValue
    : /^\d{4}-\d{2}-\d{2}$/.test(toValue)
      ? toValue
      : "";
  return source ? source.slice(0, 7) : getCurrentYm();
}

export function validateReportFilters(filters = {}) {
  const normalized = normalizeReportFilters(filters);
  if (!normalized.fromDate || !normalized.toDate) {
    return "Vui lòng chọn đủ từ ngày và đến ngày.";
  }
  if (normalized.fromDate > normalized.toDate) {
    return "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.";
  }
  return "";
}

export function buildFinanceReportVm({
  filters = {},
  accounts = [],
  transactions = [],
  expenseScopes = [],
} = {}) {
  const normalizedFilters = normalizeReportFilters(filters);
  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter(
    (transaction) =>
      isReportTransactionType(transaction?.type) && includesAccount(transaction, normalizedFilters.accountId)
  );

  const summary = buildReportSummary(
    filteredTransactions,
    normalizedFilters.fromDate,
    normalizedFilters.toDate
  );
  const balanceSnapshot = buildReportBalanceSnapshot(accounts, normalizedFilters.accountId);
  const categoryItems = buildCategoryBreakdown(filteredTransactions, summary.expenseTotal);
  const scopeItems = buildScopeBreakdown(filteredTransactions, expenseScopes, summary.expenseTotal);
  const accountItems = buildAccountBreakdown(
    filteredTransactions,
    accounts,
    normalizedFilters.accountId
  );
  const largestExpense = buildLargestExpenseHighlight(filteredTransactions, accounts, expenseScopes);
  summary.totalBalanceText = balanceSnapshot.totalBalanceText;
  summary.transferMetaText = `Chuyển khoản ${summary.transferTotalText}`;

  return {
    filters: normalizedFilters,
    summary,
    cashSnapshot: balanceSnapshot,
    quickSignals: {
      items: buildQuickSignals({
        scopeItems,
        categoryItems,
        accountItems,
      }),
      emptyTitle: "Chưa có tóm tắt kỳ",
      emptyBody: "Khi có giao dịch trong kỳ, phần này sẽ gợi ý điểm đáng chú ý.",
    },
    attentionItems: {
      items: buildAttentionItems({
        scopeItems,
        categoryItems,
        accountItems,
        largestExpense,
      }),
      largestExpense,
      emptyTitle: "Chưa có điểm đáng lưu ý",
      emptyBody: "Gợi ý sẽ hiện khi kỳ đang xem có đủ giao dịch.",
    },
    categoryBreakdown: {
      items: categoryItems,
      emptyTitle: "Chưa có khoản chi trong kỳ này",
      emptyBody: "Danh mục chi tiêu sẽ xuất hiện khi có giao dịch chi trong khoảng ngày đã chọn.",
    },
    scopeBreakdown: {
      items: scopeItems,
      emptyTitle: "Chưa có nhóm chi trong kỳ này",
      emptyBody: "Nhóm chi sẽ xuất hiện khi các khoản chi đã được gắn nhóm cụ thể.",
    },
    accountBreakdown: {
      items: accountItems,
      emptyTitle: "Chưa có biến động tài khoản trong kỳ này",
      emptyBody: "Phát sinh vào, phát sinh ra và biến động ròng sẽ xuất hiện khi có giao dịch phù hợp.",
    },
    filterOptions: {
      accountOptions: buildAccountFilterOptions(
        accounts,
        filteredTransactions,
        normalizedFilters.accountId
      ),
    },
    emptyState: {
      isEmpty: filteredTransactions.length === 0,
      title: "Không có giao dịch trong kỳ đang xem",
      body: "Hãy đổi khoảng ngày hoặc chọn tài khoản khác để xem thêm số liệu.",
    },
    meta: {
      rangeLabel: summary.rangeLabel,
      transactionCountLabel: `${summary.transactionCount} giao dịch`,
      accountFilterLabel:
        normalizedFilters.accountId === "all"
          ? "Tất cả tài khoản"
          : filterAccountLabel(accounts, normalizedFilters.accountId),
      exclusionNote: "Không gồm cho mượn / trả lại",
      cashSnapshotCount: balanceSnapshot?.items?.length || 0,
      cashSnapshotSubtitle: `${balanceSnapshot?.items?.length || 0} ví đang dùng`,
    },
  };
}

function filterAccountLabel(accounts = [], accountId = "") {
  const match = (Array.isArray(accounts) ? accounts : []).find(
    (account) => String(account?.id || "").trim() === String(accountId || "").trim()
  );
  return match?.name || "Tài khoản đã chọn";
}
