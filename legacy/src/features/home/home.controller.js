import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { prevYm } from "../../shared/ui/core.js";
import { summarizeFinanceTotals } from "../../shared/utils/finance.shared.js";
import {
  buildFinanceVm,
  formatCurrency,
  formatCurrencyCompact,
  formatDateLabel,
  formatMonthLabel,
  getCurrentYm,
  getTodayInputValue,
  toDateInputValue,
} from "../finance/finance.controller.js";
import { buildLoansVm } from "../loans/loans.controller.js";
import {
  buildDailyFlow,
  buildDefaultReportFilters,
  buildCategoryBreakdown,
} from "../reports/reports.controller.js";

function includesAccount(transaction, accountId = "all") {
  const target = String(accountId || "").trim();
  if (!target || target === "all") return true;
  return (
    String(transaction?.accountId || "").trim() === target ||
    String(transaction?.toAccountId || "").trim() === target
  );
}

export function normalizeHomeAccountFilter(accountId = "all", accounts = []) {
  const normalized = String(accountId || "all").trim() || "all";
  if (normalized === "all") return "all";
  const exists = (Array.isArray(accounts) ? accounts : []).some(
    (item) => String(item?.id || "").trim() === normalized && String(item?.status || "active") !== "archived"
  );
  return exists ? normalized : "all";
}

function buildDeltaMetric(current = 0, previous = 0) {
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

function buildKpiValue(amount = 0) {
  const full = formatCurrency(amount);
  const compact = formatCurrencyCompact(amount);
  return {
    valueText: compact,
    valueTitle: full !== compact ? full : "",
  };
}

function buildMomComparison(currentSummary = {}, previousSummary = {}) {
  return [
    {
      key: "expense",
      label: t("home.momExpense", "Chi tiêu"),
      currentText: formatCurrencyCompact(currentSummary.expenseTotal || 0),
      currentTitle: formatCurrency(currentSummary.expenseTotal || 0),
      previousText: formatCurrencyCompact(previousSummary.expenseTotal || 0),
      previousTitle: formatCurrency(previousSummary.expenseTotal || 0),
      ...buildDeltaMetric(currentSummary.expenseTotal, previousSummary.expenseTotal),
    },
    {
      key: "income",
      label: t("home.momIncome", "Thu nhập"),
      currentText: formatCurrencyCompact(currentSummary.incomeTotal || 0),
      currentTitle: formatCurrency(currentSummary.incomeTotal || 0),
      previousText: formatCurrencyCompact(previousSummary.incomeTotal || 0),
      previousTitle: formatCurrency(previousSummary.incomeTotal || 0),
      ...buildDeltaMetric(currentSummary.incomeTotal, previousSummary.incomeTotal),
    },
    {
      key: "net",
      label: t("home.momNet", "Còn lại"),
      currentText: formatCurrencyCompact(currentSummary.netTotal || 0),
      currentTitle: formatCurrency(currentSummary.netTotal || 0),
      previousText: formatCurrencyCompact(previousSummary.netTotal || 0),
      previousTitle: formatCurrency(previousSummary.netTotal || 0),
      ...buildDeltaMetric(currentSummary.netTotal, previousSummary.netTotal),
    },
  ];
}

export function buildHomeVm({
  monthKey = getCurrentYm(),
  accounts = [],
  expenseScopes = [],
  currentMonthTransactions = [],
  previousMonthTransactions = [],
  loanParties = [],
  loanTransactions = [],
  loansDataLoaded = true,
  includeDailyFlow = true,
  includeMomComparison = false,
  accountId = "all",
} = {}) {
  const normalizedMonth = String(monthKey || getCurrentYm()).trim() || getCurrentYm();
  const prevMonthKey = prevYm(normalizedMonth);
  const activeAccounts = (Array.isArray(accounts) ? accounts : []).filter(
    (item) => String(item?.status || "active") !== "archived"
  );
  const accountFilterId = normalizeHomeAccountFilter(accountId, activeAccounts);
  const filteredMonthTransactions = (Array.isArray(currentMonthTransactions) ? currentMonthTransactions : []).filter(
    (transaction) => includesAccount(transaction, accountFilterId)
  );
  const filteredPreviousMonthTransactions = (
    Array.isArray(previousMonthTransactions) ? previousMonthTransactions : []
  ).filter((transaction) => includesAccount(transaction, accountFilterId));
  const selectedAccount = activeAccounts.find((item) => String(item?.id || "").trim() === accountFilterId) || null;

  const monthFilters = buildDefaultReportFilters(normalizedMonth);
  const financeVm = buildFinanceVm({
    month: normalizedMonth,
    accounts,
    transactions: filteredMonthTransactions,
    expenseScopes,
    filters: {
      preset: "month",
      accountId: accountFilterId,
      type: "all",
      categoryKey: "all",
      scopeId: "all",
      date: getTodayInputValue(),
      search: "",
    },
  });

  const dailyFlowRaw = includeDailyFlow
    ? buildDailyFlow(filteredMonthTransactions, monthFilters.fromDate, monthFilters.toDate)
    : null;

  const loansVm = buildLoansVm({
    accounts,
    parties: loanParties,
    transactions: loanTransactions,
    selectedPartyId: "",
  });

  const currentSummary = summarizeFinanceTotals(filteredMonthTransactions);
  const previousSummary = summarizeFinanceTotals(filteredPreviousMonthTransactions);
  const incomeKpi = buildKpiValue(financeVm?.summary?.incomeTotal || 0);
  const expenseKpi = buildKpiValue(financeVm?.summary?.expenseTotal || 0);
  const netKpi = buildKpiValue(financeVm?.summary?.netTotal || 0);
  const accountHighlights = (financeVm?.summary?.accountHighlights || []).map((card) => {
    const account = (financeVm?.activeAccounts || []).find((item) => item.id === card.id);
    const balance = Number(account?.currentBalance || 0);
    return {
      ...card,
      balanceText: formatCurrency(balance),
      balanceTitle: "",
      isFiltered: accountFilterId !== "all" && String(card?.id || "").trim() === accountFilterId,
    };
  });

  const todayKey = getTodayInputValue();
  const todayIncomeExpenseTransactions = filteredMonthTransactions.filter((transaction) => {
    const type = String(transaction?.type || "").trim();
    if (!["expense", "income"].includes(type)) return false;
    return toDateInputValue(transaction?.occurredAt) === todayKey;
  });

  const financeVmToday = buildFinanceVm({
    month: normalizedMonth,
    accounts,
    transactions: todayIncomeExpenseTransactions,
    expenseScopes,
    filters: {
      preset: "today",
      accountId: accountFilterId,
      type: "all",
      categoryKey: "all",
      scopeId: "all",
      date: todayKey,
      search: "",
    },
  });

  const todayIncomeTotal = Number(financeVmToday?.summary?.incomeTotal || 0);
  const todayExpenseTotal = Number(financeVmToday?.summary?.expenseTotal || 0);

  const todayLedger = {
    dateLabel: formatDateLabel(todayKey),
    incomeTotalText: formatCurrency(todayIncomeTotal),
    expenseTotalText: formatCurrency(todayExpenseTotal),
    items: (financeVmToday?.ledger?.rows || []).slice(0, 4),
    moreCount: Math.max(0, (financeVmToday?.ledger?.rows || []).length - 4),
    emptyTitle: t("home.todayEmpty", "Chưa có thu chi"),
    emptyBody: "",
    filterNote:
      accountFilterId !== "all" && selectedAccount?.name
        ? formatTemplate(t("home.filterActiveNote", "Đang lọc theo {{account}}"), {
            account: String(selectedAccount.name).trim(),
          })
        : "",
  };

  const balanceKpi = buildKpiValue(financeVm?.summary?.totalBalance || 0);
  const monthBar = [
    {
      key: "balance",
      label: t("home.kpiBalance", "Số dư"),
      valueText: balanceKpi.valueText,
      valueTitle: balanceKpi.valueTitle,
      note: "",
      tone: "balance",
    },
    {
      key: "income",
      label: t("home.kpiIncome", "Thu"),
      valueText: incomeKpi.valueText,
      valueTitle: incomeKpi.valueTitle,
      note: "",
      tone: "income",
    },
    {
      key: "expense",
      label: t("home.kpiExpense", "Chi"),
      valueText: expenseKpi.valueText,
      valueTitle: expenseKpi.valueTitle,
      note: "",
      tone: "expense",
    },
    {
      key: "net",
      label: t("home.kpiNet", "Còn lại"),
      valueText: netKpi.valueText,
      valueTitle: netKpi.valueTitle,
      note: "",
      tone: "net",
    },
    {
      key: "debt",
      label: t("home.kpiDebt", "Cho mượn"),
      valueText: loansDataLoaded ? formatCurrency(loansVm?.summary?.totalOutstanding || 0) : "—",
      valueTitle: "",
      note: "",
      tone: "warning",
      link: "#loans",
    },
  ];

  const expenseTotal = Number(currentSummary.expenseTotal || 0);
  const categoryItems = buildCategoryBreakdown(filteredMonthTransactions, expenseTotal).slice(0, 5);

  const recentCutoffDate = (() => {
    const anchor = new Date(`${todayKey}T12:00:00`);
    anchor.setDate(anchor.getDate() - 6);
    return toDateInputValue(anchor);
  })();
  const recentFinanceVm = buildFinanceVm({
    month: normalizedMonth,
    accounts,
    transactions: filteredMonthTransactions.filter((transaction) => {
      const dateKey = toDateInputValue(transaction?.occurredAt);
      return dateKey && dateKey >= recentCutoffDate && dateKey <= todayKey;
    }),
    expenseScopes,
    filters: {
      preset: "month",
      accountId: accountFilterId,
      type: "all",
      categoryKey: "all",
      scopeId: "all",
      date: todayKey,
      search: "",
    },
  });

  return {
    monthKey: normalizedMonth,
    prevMonthKey,
    monthLabel: financeVm?.monthLabel || formatMonthLabel(normalizedMonth),
    prevMonthLabel: formatMonthLabel(prevMonthKey),
    accountHighlights,
    todayLedger,
    monthBar,
    categoryBreakdown: {
      items: categoryItems,
      emptyTitle: t("home.noCategory", "Chưa có chi"),
      emptyBody: "",
    },
    recentTransactions: {
      items: (recentFinanceVm?.ledger?.rows || []).slice(0, 8),
      emptyTitle: t("home.noRecent", "Chưa có giao dịch gần đây"),
      emptyBody: "",
    },
    momComparison: includeMomComparison
      ? {
          loadPending: false,
          prevMonthLabel: formatMonthLabel(prevMonthKey),
          items: buildMomComparison(currentSummary, previousSummary),
        }
      : {
          loadPending: true,
          emptyTitle: t("home.momLoadTitle", "So với tháng trước"),
          emptyBody: "",
        },
    dailyFlow: includeDailyFlow
      ? {
          ...dailyFlowRaw,
          emptyTitle: t("home.dailyFlowEmpty", "Chưa có chi"),
          emptyBody: "",
        }
      : {
          loadPending: true,
          emptyTitle: t("home.dailyFlowLoadTitle", "Dòng tiền theo ngày"),
          emptyBody: "",
        },
    accountFilter: {
      accountId: accountFilterId,
      options: activeAccounts.map((account) => ({
        id: String(account?.id || "").trim(),
        name: String(account?.name || "").trim(),
      })),
      label:
        accountFilterId === "all"
          ? t("home.filterAll", "Tất cả ví")
          : String(selectedAccount?.name || "").trim(),
    },
    navbar: {
      expenseTotal: financeVm?.summary?.expenseTotal || 0,
      incomeTotal: financeVm?.summary?.incomeTotal || 0,
      balanceTotal: financeVm?.summary?.totalBalance || 0,
    },
  };
}
