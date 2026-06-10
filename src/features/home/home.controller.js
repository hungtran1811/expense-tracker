import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { PROFILE_VI } from "../../shared/constants/profile.vi.js";
import { prevYm } from "../../shared/ui/core.js";
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
} from "../reports/reports.controller.js";

const WEEKDAY_LABELS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function isFinanceTransactionType(type = "") {
  return ["expense", "income", "transfer", "adjustment"].includes(String(type || "").trim());
}

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

function summarizeTransactions(transactions = []) {
  const items = (Array.isArray(transactions) ? transactions : []).filter((transaction) =>
    isFinanceTransactionType(transaction?.type)
  );

  const incomeTotal = items
    .filter((item) => String(item?.type || "") === "income")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const expenseTotal = items
    .filter((item) => String(item?.type || "") === "expense")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const adjustmentTotal = items
    .filter((item) => String(item?.type || "") === "adjustment")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);

  return {
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal + adjustmentTotal,
  };
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

function buildHeroContext(monthKey = getCurrentYm()) {
  const now = new Date();
  const hour = now.getHours();
  let greeting = PROFILE_VI.greetingEvening || "Chào";
  if (hour < 12) greeting = PROFILE_VI.greetingMorning || greeting;
  else if (hour < 18) greeting = PROFILE_VI.greetingAfternoon || greeting;

  const weekday = WEEKDAY_LABELS[now.getDay()] || "";
  const dateLabel = `${weekday}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const monthLabel = formatMonthLabel(monthKey);

  return {
    greeting,
    shortName: PROFILE_VI.shortName || "Hưng",
    title: `${greeting} ${PROFILE_VI.shortName || "Hưng"}`,
    dateLabel,
    monthLabel,
    tagline: formatTemplate(t("home.heroTagline", "Theo dõi chi tiêu tháng {{month}}"), { month: monthLabel }),
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

  const dailyFlowRaw = buildDailyFlow(
    filteredMonthTransactions,
    monthFilters.fromDate,
    monthFilters.toDate
  );

  const loansVm = buildLoansVm({
    accounts,
    parties: loanParties,
    transactions: loanTransactions,
    selectedPartyId: "",
  });

  const currentSummary = summarizeTransactions(filteredMonthTransactions);
  const previousSummary = summarizeTransactions(filteredPreviousMonthTransactions);
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
    items: financeVmToday?.ledger?.rows || [],
    emptyTitle: t("home.todayEmpty", "Chưa có thu chi hôm nay"),
    emptyBody: t("home.todayEmptyBody", "Ghi khoản thu hoặc chi để theo dõi trong ngày."),
    filterNote:
      accountFilterId !== "all" && selectedAccount?.name
        ? formatTemplate(t("home.filterActiveNote", "Đang lọc theo {{account}}"), {
            account: String(selectedAccount.name).trim(),
          })
        : "",
  };

  const monthBar = [
    {
      key: "income",
      label: t("home.kpiIncome", "Thu tháng này"),
      valueText: incomeKpi.valueText,
      valueTitle: incomeKpi.valueTitle,
      note: financeVm?.monthLabel || "",
      tone: "income",
    },
    {
      key: "expense",
      label: t("home.kpiExpense", "Chi tháng này"),
      valueText: expenseKpi.valueText,
      valueTitle: expenseKpi.valueTitle,
      note: financeVm?.monthLabel || "",
      tone: "expense",
    },
    {
      key: "net",
      label: t("home.kpiNet", "Còn lại"),
      valueText: netKpi.valueText,
      valueTitle: netKpi.valueTitle,
      note: t("glossary.netBalanceNote", "Thu − Chi"),
      tone: "net",
    },
    {
      key: "debt",
      label: t("home.kpiDebt", "Tiền cho mượn"),
      valueText: formatCurrency(loansVm?.summary?.totalOutstanding || 0),
      valueTitle: "",
      note: loansVm?.summary?.activePartyCountText || "0 người",
      tone: "warning",
      link: "#loans",
    },
  ];

  return {
    hero: buildHeroContext(normalizedMonth),
    monthKey: normalizedMonth,
    prevMonthKey,
    monthLabel: financeVm?.monthLabel || formatMonthLabel(normalizedMonth),
    prevMonthLabel: formatMonthLabel(prevMonthKey),
    accountHighlights,
    todayLedger,
    monthBar,
    momComparison: buildMomComparison(currentSummary, previousSummary),
    dailyFlow: {
      ...dailyFlowRaw,
      emptyTitle: t("home.dailyFlowEmpty", "Chưa có dòng tiền tháng này"),
      emptyBody: t("home.dailyFlowEmptyBody", "Ghi thu hoặc chi để theo dõi biến động từng ngày."),
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
