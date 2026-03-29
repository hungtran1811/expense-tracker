import {
  formatCurrency,
  formatDateLabel,
  getCurrentYm,
  getTodayInputValue,
  getYmFromDateInput,
  buildScopeBudgetOverview,
} from "../finance/finance.controller.js";
import { getFinanceCategoryLabel } from "../../shared/constants/finance.constants.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateInput(value = "") {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDateInput(value = "", delta = 0) {
  const date = parseDateInput(value);
  if (!date) return "";
  date.setDate(date.getDate() + Number(delta || 0));
  return toDateInputValue(date);
}

function diffDaysInclusive(fromDate = "", toDate = "") {
  const start = parseDateInput(fromDate);
  const end = parseDateInput(toDate);
  if (!start || !end) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

function formatPercent(value = 0) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function buildRangeLabel(fromDate = "", toDate = "") {
  return `${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)}`;
}

function normalizePreset(value = "") {
  const raw = String(value || "").trim();
  return raw === "7d" || raw === "custom" ? raw : "30d";
}

function sortAccounts(accounts = []) {
  return [...accounts].sort((a, b) => {
    const archivedA = String(a?.status || "active") === "archived" ? 1 : 0;
    const archivedB = String(b?.status || "active") === "archived" ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    const defaultA = a?.isDefault ? -1 : 0;
    const defaultB = b?.isDefault ? -1 : 0;
    if (defaultA !== defaultB) return defaultA - defaultB;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function buildScopeMap(items = []) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [String(item?.id || "").trim(), item]));
}

function buildAccountMap(items = []) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [String(item?.id || "").trim(), item]));
}

function summarizeTransactions(transactions = []) {
  return (Array.isArray(transactions) ? transactions : []).reduce(
    (acc, item) => {
      const type = String(item?.type || "").trim();
      const amount = Number(item?.amount || 0);
      if (type === "income") acc.income += Math.abs(amount);
      if (type === "expense") acc.expense += Math.abs(amount);
      if (type === "transfer") acc.transfer += Math.abs(amount);
      if (type === "adjustment") acc.adjustment += amount;
      return acc;
    },
    { income: 0, expense: 0, transfer: 0, adjustment: 0 }
  );
}

function buildTrendCard(label = "", currentValue = 0, previousValue = 0, hint = "") {
  const delta = Number(currentValue || 0) - Number(previousValue || 0);
  const base = Math.abs(Number(previousValue || 0));
  const deltaPercent = base > 0 ? (delta / base) * 100 : currentValue > 0 ? 100 : 0;
  return {
    label,
    valueText: formatCurrency(currentValue),
    compareText: previousValue > 0 ? `Kỳ trước ${formatCurrency(previousValue)}` : "Kỳ trước 0đ",
    deltaText: `${delta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))}`,
    deltaPercentText: `${delta >= 0 ? "+" : ""}${formatPercent(deltaPercent)}`,
    deltaTone: delta >= 0 ? "up" : "down",
    hint,
  };
}

function buildTopCategoryItems(transactions = []) {
  const bucket = new Map();
  transactions.forEach((item) => {
    if (String(item?.type || "").trim() !== "expense") return;
    const key = String(item?.categoryKey || "other").trim() || "other";
    if (!bucket.has(key)) {
      bucket.set(key, { key, label: getFinanceCategoryLabel(key), total: 0, count: 0 });
    }
    const row = bucket.get(key);
    row.total += Math.abs(Number(item?.amount || 0));
    row.count += 1;
  });

  const totalExpense = Array.from(bucket.values()).reduce((sum, item) => sum + item.total, 0);
  return Array.from(bucket.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "vi"))
    .slice(0, 3)
    .map((item) => ({
      ...item,
      totalText: formatCurrency(item.total),
      shareText: totalExpense > 0 ? formatPercent((item.total / totalExpense) * 100) : "0.0%",
    }));
}

function buildTopScopeItems(transactions = [], expenseScopes = []) {
  const scopeMap = buildScopeMap(expenseScopes);
  const bucket = new Map();
  transactions.forEach((item) => {
    if (String(item?.type || "").trim() !== "expense") return;
    const scopeId = String(item?.scopeId || "").trim() || "unknown";
    if (!bucket.has(scopeId)) {
      bucket.set(scopeId, {
        key: scopeId,
        label: String(scopeMap.get(scopeId)?.name || "Chưa gắn phạm vi").trim(),
        total: 0,
        count: 0,
      });
    }
    const row = bucket.get(scopeId);
    row.total += Math.abs(Number(item?.amount || 0));
    row.count += 1;
  });

  const totalExpense = Array.from(bucket.values()).reduce((sum, item) => sum + item.total, 0);
  return Array.from(bucket.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "vi"))
    .slice(0, 3)
    .map((item) => ({
      ...item,
      totalText: formatCurrency(item.total),
      shareText: totalExpense > 0 ? formatPercent((item.total / totalExpense) * 100) : "0.0%",
    }));
}

function buildLargestExpenseItems(transactions = [], accounts = [], expenseScopes = []) {
  const accountMap = buildAccountMap(accounts);
  const scopeMap = buildScopeMap(expenseScopes);
  return (Array.isArray(transactions) ? transactions : [])
    .filter((item) => String(item?.type || "").trim() === "expense")
    .sort((a, b) => Number(b?.amount || 0) - Number(a?.amount || 0))
    .slice(0, 3)
    .map((item) => ({
      id: String(item?.id || "").trim(),
      title: getFinanceCategoryLabel(item?.categoryKey),
      amountText: formatCurrency(Math.abs(Number(item?.amount || 0))),
      note: String(item?.note || "").trim(),
      dateLabel: formatDateLabel(item?.occurredAt),
      accountLabel: String(accountMap.get(String(item?.accountId || "").trim())?.name || "Không rõ").trim(),
      scopeLabel: String(scopeMap.get(String(item?.scopeId || "").trim())?.name || "Chưa gắn phạm vi").trim(),
    }));
}

function buildOutflowByAccount(transactions = [], accounts = []) {
  const bucket = new Map();
  transactions.forEach((item) => {
    const accountId = String(item?.accountId || "").trim();
    if (!accountId) return;
    const type = String(item?.type || "").trim();
    const amount = Number(item?.amount || 0);
    let delta = 0;
    if (type === "expense" || type === "transfer") delta = Math.abs(amount);
    if (type === "adjustment" && amount < 0) delta = Math.abs(amount);
    if (!delta) return;
    bucket.set(accountId, (bucket.get(accountId) || 0) + delta);
  });

  const accountMap = buildAccountMap(accounts);
  return Array.from(bucket.entries())
    .map(([accountId, total]) => ({
      accountId,
      total,
      name: String(accountMap.get(accountId)?.name || "Không rõ").trim(),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}

function buildAlertCards({
  currentTransactions = [],
  expenseScopes = [],
  accounts = [],
  budgetOverview = {},
  rangeLabel = "",
} = {}) {
  const budgetItems = Array.isArray(budgetOverview?.items) ? budgetOverview.items : [];
  const alerts = [];

  const budgetRisk = budgetItems.find((item) => item.statusKey === "over") || budgetItems.find((item) => item.statusKey === "near");
  if (budgetRisk) {
    alerts.push({
      title: budgetRisk.scopeName,
      valueText: budgetRisk.statusKey === "over" ? budgetRisk.remainingText : budgetRisk.percentText,
      note:
        budgetRisk.statusKey === "over"
          ? `Vượt ngân sách ${budgetRisk.monthLabel}.`
          : `Đang gần chạm ngân sách ${budgetRisk.monthLabel}.`,
      tone: budgetRisk.statusKey === "over" ? "danger" : "warning",
    });
  }

  const outflowItems = buildOutflowByAccount(currentTransactions, accounts);
  if (outflowItems[0]) {
    alerts.push({
      title: "Chi ra nhiều nhất",
      valueText: outflowItems[0].name,
      note: `${formatCurrency(outflowItems[0].total)} trong ${rangeLabel}.`,
      tone: "neutral",
    });
  }

  const topScopes = buildTopScopeItems(currentTransactions, expenseScopes);
  if (topScopes[0]) {
    alerts.push({
      title: "Phạm vi đang chi mạnh",
      valueText: topScopes[0].label,
      note: `${topScopes[0].shareText} tổng chi kỳ này.`,
      tone: "brand",
    });
  }

  const topCategories = buildTopCategoryItems(currentTransactions);
  if (topCategories[0]) {
    alerts.push({
      title: "Danh mục nổi bật",
      valueText: topCategories[0].label,
      note: `Đứng đầu ${rangeLabel}.`,
      tone: "success",
    });
  }

  return alerts.slice(0, 4);
}

function buildAttentionItems({
  budgetOverview = {},
  topScopes = [],
  topCategories = [],
  largestExpenses = [],
  outflowByAccount = [],
  rangeLabel = "",
} = {}) {
  const items = [];
  const riskItems = (Array.isArray(budgetOverview?.items) ? budgetOverview.items : []).filter(
    (item) => item.statusKey === "over" || item.statusKey === "near"
  );

  riskItems.slice(0, 2).forEach((item) => {
    items.push(
      item.statusKey === "over"
        ? `${item.scopeName} vượt ${formatCurrency(Math.abs(item.remainingAmount || 0))} ngân sách ${item.monthLabel}.`
        : `${item.scopeName} còn ${formatCurrency(Math.max(item.remainingAmount || 0, 0))} trước ngưỡng ${item.monthLabel}.`
    );
  });

  if (topScopes[0]) {
    items.push(`${topScopes[0].label} chiếm ${topScopes[0].shareText} tổng chi.`);
  }
  if (topCategories[0]) {
    items.push(`${topCategories[0].label} là danh mục chi lớn nhất.`);
  }
  if (outflowByAccount[0]) {
    items.push(`${outflowByAccount[0].name} chi ra nhiều nhất ${rangeLabel}.`);
  }
  if (largestExpenses[0]) {
    items.push(`Khoản lớn nhất: ${largestExpenses[0].title.toLowerCase()} ${largestExpenses[0].amountText}.`);
  }

  return Array.from(new Set(items)).slice(0, 5);
}

export function buildDefaultOverviewFilters() {
  const toDate = getTodayInputValue();
  return {
    preset: "30d",
    fromDate: shiftDateInput(toDate, -29),
    toDate,
  };
}

export function normalizeOverviewFilters(filters = {}) {
  const preset = normalizePreset(filters?.preset);
  const safeToDate = parseDateInput(filters?.toDate) ? String(filters?.toDate).trim() : getTodayInputValue();

  if (preset === "7d") {
    return {
      preset,
      toDate: safeToDate,
      fromDate: shiftDateInput(safeToDate, -6),
    };
  }

  if (preset === "30d") {
    return {
      preset,
      toDate: safeToDate,
      fromDate: shiftDateInput(safeToDate, -29),
    };
  }

  const safeFromDate = parseDateInput(filters?.fromDate) ? String(filters?.fromDate).trim() : safeToDate;
  return safeFromDate <= safeToDate
    ? { preset, fromDate: safeFromDate, toDate: safeToDate }
    : { preset, fromDate: safeToDate, toDate: safeToDate };
}

export function validateOverviewFilters(filters = {}) {
  const normalized = normalizeOverviewFilters(filters);
  if (normalized.preset !== "custom") return "";
  if (!normalized.fromDate || !normalized.toDate) {
    return "Vui lòng chọn đủ từ ngày và đến ngày.";
  }
  if (normalized.fromDate > normalized.toDate) {
    return "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.";
  }
  return "";
}

export function getOverviewRange(filters = {}) {
  const normalized = normalizeOverviewFilters(filters);
  const dayCount = diffDaysInclusive(normalized.fromDate, normalized.toDate);
  return {
    ...normalized,
    dayCount,
    rangeLabel: buildRangeLabel(normalized.fromDate, normalized.toDate),
    presetLabel:
      normalized.preset === "7d"
        ? "7 ngày gần nhất"
        : normalized.preset === "30d"
          ? "30 ngày gần nhất"
          : "Kỳ tùy chỉnh",
  };
}

export function getPreviousOverviewRange(filters = {}) {
  const current = getOverviewRange(filters);
  return {
    fromDate: shiftDateInput(current.fromDate, -current.dayCount),
    toDate: shiftDateInput(current.fromDate, -1),
  };
}

export function getOverviewBudgetMonthKey(filters = {}) {
  return getYmFromDateInput(normalizeOverviewFilters(filters).toDate) || getCurrentYm();
}

export function buildOverviewVm({
  filters = {},
  accounts = [],
  currentTransactions = [],
  previousTransactions = [],
  expenseScopes = [],
  scopeBudgets = [],
  budgetTransactions = [],
} = {}) {
  const range = getOverviewRange(filters);
  const currentSummary = summarizeTransactions(currentTransactions);
  const previousSummary = summarizeTransactions(previousTransactions);
  const activeAccounts = sortAccounts(accounts).filter((item) => String(item?.status || "active") !== "archived");
  const totalBalance = activeAccounts.reduce((sum, item) => sum + Number(item?.currentBalance || 0), 0);
  const budgetOverview = buildScopeBudgetOverview({
    month: getOverviewBudgetMonthKey(filters),
    transactions: budgetTransactions,
    scopeBudgets,
    expenseScopes,
  });
  const topCategories = buildTopCategoryItems(currentTransactions);
  const topScopes = buildTopScopeItems(currentTransactions, expenseScopes);
  const largestExpenses = buildLargestExpenseItems(currentTransactions, activeAccounts, expenseScopes);
  const outflowByAccount = buildOutflowByAccount(currentTransactions, activeAccounts);

  return {
    filters: range,
    meta: {
      rangeLabel: range.rangeLabel,
      presetLabel: range.presetLabel,
      transactionCountLabel: `${Number(currentTransactions?.length || 0)} giao dịch`,
    },
    cashSnapshot: {
      totalBalanceText: formatCurrency(totalBalance),
      accounts: activeAccounts.slice(0, 4).map((account) => ({
        id: account.id,
        name: account.name,
        balanceText: formatCurrency(account.currentBalance || 0),
        metaText: account.isDefault ? "Mặc định" : "Số dư hiện tại",
        isDefault: !!account.isDefault,
      })),
    },
    alerts: buildAlertCards({
      currentTransactions,
      expenseScopes,
      accounts: activeAccounts,
      budgetOverview,
      rangeLabel: range.presetLabel.toLowerCase(),
    }),
    trendComparison: [
      buildTrendCard("Thu", currentSummary.income, previousSummary.income, "So với kỳ trước cùng độ dài"),
      buildTrendCard("Chi", currentSummary.expense, previousSummary.expense, "So với kỳ trước cùng độ dài"),
      buildTrendCard(
        "Chênh lệch",
        currentSummary.income - currentSummary.expense + currentSummary.adjustment,
        previousSummary.income - previousSummary.expense + previousSummary.adjustment,
        "Thu - Chi + Điều chỉnh"
      ),
    ],
    topCategories: {
      title: "Danh mục chi lớn",
      items: topCategories,
      emptyTitle: "Chưa có danh mục nổi bật",
      emptyBody: "Các danh mục chi lớn nhất sẽ hiện lên khi có khoản chi trong kỳ đang xem.",
    },
    topScopes: {
      title: "Phạm vi chi lớn",
      items: topScopes,
      emptyTitle: "Chưa có phạm vi chi nổi bật",
      emptyBody: "Hãy gắn phạm vi chi cho các khoản chi để nhìn ra ai đang dùng quỹ nhiều hơn.",
    },
    largestExpenses: {
      title: "Khoản chi lớn gần đây",
      items: largestExpenses,
      emptyTitle: "Chưa có khoản chi lớn gần đây",
      emptyBody: "Khi có khoản chi trong kỳ, phần này sẽ giúp bạn nhìn ra chi tiêu đáng chú ý ngay.",
    },
    attentionItems: buildAttentionItems({
      budgetOverview,
      topScopes,
      topCategories,
      largestExpenses,
      outflowByAccount,
      rangeLabel: range.presetLabel.toLowerCase(),
    }),
    emptyState: {
      isEmpty: !currentTransactions.length,
      title: "Chưa có giao dịch trong kỳ đang xem",
      body: "Đổi kỳ xem hoặc bắt đầu ghi sổ để màn Tổng quan hiển thị insight hữu ích hơn.",
    },
  };
}
