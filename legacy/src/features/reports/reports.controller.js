import {
  getAccountTypeLabel,
  getFinanceCategoryLabel,
  getTransactionTypeLabel,
} from "../../shared/constants/finance.constants.js";
import { prevYm } from "../../shared/ui/core.js";
import {
  isFinanceTransactionType,
  summarizeFinanceTotals,
} from "../../shared/utils/finance.shared.js";
import {
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getCurrentYm,
  getTodayInputValue,
  getYmFromDateInput,
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

export function buildCategoryBreakdown(transactions = [], totalExpense = 0) {
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
          label: "Nhóm chi",
          valueText: topScope.label,
          note: topScope.shareText,
          tone: "brand",
        }
      : null,
    topCategory
      ? {
          label: "Danh mục",
          valueText: topCategory.label,
          note: topCategory.shareText,
          tone: "success",
        }
      : null,
    topOutflowAccount
      ? {
          label: "Ví chi nhiều",
          valueText: topOutflowAccount.name,
          note: formatCurrency(topOutflowAccount.outflow),
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

function buildReportDeltaMetric(current = 0, previous = 0) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  const deltaAbs = cur - prev;

  if (prev === 0) {
    return {
      deltaText: cur === 0 ? "0%" : "Mới",
      deltaTone: cur >= 0 ? "up" : "down",
      deltaAbsText: formatCurrency(Math.abs(deltaAbs)),
    };
  }

  const pct = (deltaAbs / prev) * 100;
  return {
    deltaText: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    deltaTone: pct >= 0 ? "up" : "down",
    deltaAbsText: formatCurrency(Math.abs(deltaAbs)),
  };
}

export function buildPreviousReportFilters(filters = {}) {
  const normalized = normalizeReportFilters(filters);
  const monthKey = normalized.month || getYmFromDateInput(normalized.fromDate) || getCurrentYm();
  return buildDefaultReportFilters(prevYm(monthKey));
}

export function buildReportMomComparison(currentTransactions = [], previousTransactions = []) {
  const currentSummary = summarizeFinanceTotals(currentTransactions);
  const previousSummary = summarizeFinanceTotals(previousTransactions);

  return {
    loadPending: false,
    prevRangeLabel: "",
    items: [
      {
        key: "expense",
        label: "Chi tiêu",
        currentText: formatCurrency(currentSummary.expenseTotal || 0),
        previousText: formatCurrency(previousSummary.expenseTotal || 0),
        ...buildReportDeltaMetric(currentSummary.expenseTotal, previousSummary.expenseTotal),
      },
      {
        key: "income",
        label: "Thu nhập",
        currentText: formatCurrency(currentSummary.incomeTotal || 0),
        previousText: formatCurrency(previousSummary.incomeTotal || 0),
        ...buildReportDeltaMetric(currentSummary.incomeTotal, previousSummary.incomeTotal),
      },
      {
        key: "net",
        label: "Còn lại",
        currentText: formatCurrency(currentSummary.netTotal || 0),
        previousText: formatCurrency(previousSummary.netTotal || 0),
        ...buildReportDeltaMetric(currentSummary.netTotal, previousSummary.netTotal),
      },
    ],
  };
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
      isFinanceTransactionType(transaction?.type) && includesAccount(transaction, normalizedFilters.accountId)
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
      emptyTitle: "Chưa có điểm nổi bật",
      emptyBody: "",
    },
    attentionItems: {
      items: buildAttentionItems({
        scopeItems,
        categoryItems,
        accountItems,
        largestExpense,
      }),
      largestExpense,
      emptyTitle: "Chưa có khoản lớn",
      emptyBody: "",
    },
    categoryBreakdown: {
      items: categoryItems,
      emptyTitle: "Chưa có chi",
      emptyBody: "",
    },
    scopeBreakdown: {
      items: scopeItems,
      emptyTitle: "Chưa có nhóm chi",
      emptyBody: "",
    },
    accountBreakdown: {
      items: accountItems,
      emptyTitle: "Chưa có biến động",
      emptyBody: "",
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
      title: "Không có giao dịch trong kỳ",
      body: "",
    },
    dailyFlow: {
      ...buildDailyFlow(
        filteredTransactions,
        normalizedFilters.fromDate,
        normalizedFilters.toDate
      ),
      emptyTitle: "Chưa có chi",
      emptyBody: "",
    },
    recentTransactions: {
      items: buildReportRecentTransactions(filteredTransactions, accounts, expenseScopes),
      emptyTitle: "Chưa có giao dịch gần đây",
      emptyBody: "Các giao dịch mới nhất trong kỳ sẽ hiện tại đây.",
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

function buildReportRecentTransactions(transactions = [], accounts = [], expenseScopes = [], limit = 10) {
  const accountMap = new Map(
    (Array.isArray(accounts) ? accounts : []).map((item) => [String(item?.id || "").trim(), item])
  );
  const scopeMap = new Map(
    (Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => [String(item?.id || "").trim(), item])
  );

  return [...(Array.isArray(transactions) ? transactions : [])]
    .filter((item) => isFinanceTransactionType(item?.type))
    .sort((a, b) => {
      const dateDiff = String(toDateInputValue(b?.occurredAt) || "").localeCompare(
        String(toDateInputValue(a?.occurredAt) || "")
      );
      if (dateDiff !== 0) return dateDiff;
      return String(b?.id || "").localeCompare(String(a?.id || ""));
    })
    .slice(0, limit)
    .map((transaction) => {
      const type = String(transaction?.type || "").trim();
      const amount = Number(transaction?.amount || 0);
      const absText = formatCurrency(Math.abs(amount));
      const account = accountMap.get(String(transaction?.accountId || "").trim());
      const scope = scopeMap.get(String(transaction?.scopeId || "").trim());
      const title =
        String(transaction?.note || "").trim() ||
        (type === "expense"
          ? getFinanceCategoryLabel(transaction?.categoryKey)
          : getTransactionTypeLabel(type));
      const signed =
        type === "income" || (type === "adjustment" && amount >= 0)
          ? `+${absText}`
          : type === "transfer"
            ? absText
            : `-${absText}`;
      return {
        id: String(transaction?.id || "").trim(),
        title,
        dateLabel: formatDateLabel(transaction?.occurredAt),
        categoryLabel: type === "expense" ? getFinanceCategoryLabel(transaction?.categoryKey) : getTransactionTypeLabel(type),
        accountLabel: account?.name || "",
        scopeLabel: scope?.name || "",
        amountText: signed,
        amountClass:
          type === "income" || (type === "adjustment" && amount >= 0)
            ? "positive"
            : type === "transfer"
              ? "neutral"
              : "negative",
      };
    });
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function reportAccountLabel(transaction, accountMap) {
  const fromAccount = accountMap.get(String(transaction?.accountId || "").trim());
  const toAccount = accountMap.get(String(transaction?.toAccountId || "").trim());
  if (String(transaction?.type || "").trim() === "transfer") {
    return `${String(fromAccount?.name || "Không rõ")} → ${String(toAccount?.name || "Không rõ")}`;
  }
  return String(fromAccount?.name || "Không rõ");
}

function reportAmountText(transaction) {
  const amount = Number(transaction?.amount || 0);
  const type = String(transaction?.type || "").trim();
  const abs = formatCurrency(Math.abs(amount));
  if (type === "expense") return `-${abs}`;
  if (type === "income") return `+${abs}`;
  if (type === "adjustment") return `${amount >= 0 ? "+" : "-"}${abs}`;
  return abs;
}

export function buildReportCsvContent({
  transactions = [],
  accounts = [],
  expenseScopes = [],
  filters = {},
} = {}) {
  const normalized = normalizeReportFilters(filters);
  const accountMap = new Map(
    (Array.isArray(accounts) ? accounts : []).map((item) => [String(item?.id || "").trim(), item])
  );
  const scopeMap = buildExpenseScopeMap(expenseScopes);
  const rows = (Array.isArray(transactions) ? transactions : []).filter(
    (transaction) =>
      isFinanceTransactionType(transaction?.type) && includesAccount(transaction, normalized.accountId)
  );

  const header = ["Ngày", "Loại", "Tài khoản", "Danh mục", "Nhóm chi", "Ghi chú", "Số tiền"];
  const lines = [header.join(",")];

  rows.forEach((transaction) => {
    const type = String(transaction?.type || "").trim();
    const values = [
      formatDateLabel(transaction?.occurredAt),
      getTransactionTypeLabel(type),
      reportAccountLabel(transaction, accountMap),
      type === "expense" ? getFinanceCategoryLabel(transaction?.categoryKey) : "",
      type === "expense" ? String(scopeMap.get(String(transaction?.scopeId || "").trim()) || "") : "",
      String(transaction?.note || "").trim(),
      reportAmountText(transaction),
    ].map(csvEscape);
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

export function buildAiReportInsightPayload(vm = {}, options = {}) {
  const summary = vm?.summary || {};
  const filters = vm?.filters || {};
  const categoryItems = Array.isArray(vm?.categoryBreakdown?.items) ? vm.categoryBreakdown.items : [];
  const topCategoryItem = categoryItems[0] || null;
  const momItems = Array.isArray(options?.momComparison?.items) ? options.momComparison.items : [];
  const chiMom = momItems.find((item) => item?.key === "expense");
  const netMom = momItems.find((item) => item?.key === "net");

  const expenseByDay = new Map();
  (Array.isArray(options?.transactions) ? options.transactions : []).forEach((transaction) => {
    if (String(transaction?.type || "").trim() !== "expense") return;
    if (!includesAccount(transaction, filters.accountId || "all")) return;
    const dateKey = toDateInputValue(transaction?.occurredAt);
    if (!dateKey) return;
    expenseByDay.set(dateKey, Number(expenseByDay.get(dateKey) || 0) + Math.abs(Number(transaction?.amount || 0)));
  });

  let topDay = null;
  expenseByDay.forEach((amount, dateKey) => {
    if (!topDay || amount > topDay.amount) {
      topDay = { date: formatDateLabel(dateKey), amount };
    }
  });

  return {
    monthLabel: summary.rangeLabel || formatMonthLabel(filters.month || getCurrentYm()),
    accountLabel: vm?.meta?.accountFilterLabel || "Tất cả tài khoản",
    totalChi: Number(summary.expenseTotal || 0),
    totalThu: Number(summary.incomeTotal || 0),
    net: Number(summary.netTotal || 0),
    chiCompareText: chiMom?.deltaText || "",
    netCompareText: netMom?.deltaText || "",
    topCategory: topCategoryItem
      ? {
          name: topCategoryItem.label,
          amount: Number(topCategoryItem.total || topCategoryItem.amount || 0),
        }
      : null,
    topDay,
  };
}
