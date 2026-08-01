import { parseHashRoute, setActiveRoute } from "./router.js";
import { bindKeyboardShortcuts } from "./shortcuts.js";
import { bindAuthButtons, watchAuth } from "../services/firebase/auth.js";
import {
  setGlobalLoading,
  showToast,
  prevYm,
  setTopbarStatsVisible,
  updateNavbarStats,
  updateUserMenuUI,
  syncBrandUI,
} from "../shared/ui/core.js";
import { bindFilterControls, syncFilterControls } from "../shared/ui/filterControls.js";
import { formatTemplate, t } from "../shared/constants/copy.vi.js";
import { migrateLegacyStorageKeys } from "../shared/constants/keys.js";
import { filterTransactionsByDateRange } from "../shared/utils/finance.shared.js";
import {
  buildCsvContent,
  buildFinanceVm,
  buildScopeBudgetPanel,
  buildTransactionDraft,
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getFinanceRange,
  getCurrentYm,
  getTodayInputValue,
  getYmFromDateInput,
  sanitizeAccountDraft,
  sanitizeAccountEditDraft,
  sanitizeTransactionDraft,
} from "../features/finance/finance.controller.js";
import { bindFinanceEvents } from "../features/finance/finance.events.js";
import {
  renderExpenseCategoryForm,
  renderExpenseScopeForm,
  renderFinanceComposer,
  renderFinanceAccountForm,
  renderFinanceRoute,
  resetFinanceAccountForm,
} from "../features/finance/finance.ui.js";
import {
  buildLoanEntryContext,
  buildLoanEntryDraft,
  buildLoanPartyDraft,
  buildLoansVm,
  sanitizeLoanEntryDraft,
  sanitizeLoanPartyDraft,
} from "../features/loans/loans.controller.js";
import { bindLoanEvents } from "../features/loans/loans.events.js";
import {
  renderLoanEntryForm,
  renderLoanPartyForm,
  renderLoansRoute,
} from "../features/loans/loans.ui.js";
import {
  buildDefaultReportFilters,
  buildFinanceReportVm,
  buildPreviousReportFilters,
  buildReportCsvContent,
  buildReportFiltersForPreset,
  buildReportMomComparison,
  normalizeReportFilters,
  resolveReportPreset,
  validateReportFilters,
} from "../features/reports/reports.controller.js";
import { bindReportEvents } from "../features/reports/reports.events.js";
import { renderReportsRoute } from "../features/reports/reports.ui.js";
import { buildHomeVm, normalizeHomeAccountFilter } from "../features/home/home.controller.js";
import { bindHomeEvents } from "../features/home/home.events.js";
import { renderHomeRoute } from "../features/home/home.ui.js";
import {
  archiveAccount,
  createAccount,
  createExpenseCategory,
  createExpenseScope,
  createLoanParty,
  createRecurringRule,
  createSavingsGoal,
  createTransaction,
  deleteExpenseCategory,
  deleteExpenseScope,
  deleteLoanParty,
  deleteRecurringRule,
  deleteSavingsGoal,
  deleteScopeBudget,
  deleteTransaction,
  listAccountsWithBalances,
  listExpenseCategories,
  listExpenseScopes,
  listLoanParties,
  listLoanTransactions,
  listRecurringRules,
  listSavingsGoals,
  listScopeBudgets,
  listTransactions,
  resetFinanceData,
  saveScopeBudget,
  updateExpenseCategory,
  updateExpenseScope,
  updateLedgerAccount,
  updateLoanParty,
  updateSavingsGoal,
  updateTransaction,
} from "../services/firebase/firestore.js";
import { setExpenseCategoryCache } from "../shared/constants/finance.constants.js";
import {
  buildGlobalSearchResults,
  renderGlobalSearchResults,
} from "../features/growth/globalSearch.js";
import {
  buildTransactionFromRecurringRule,
  clearRecurringForm,
  readRecurringForm,
  renderRecurringSection,
  sanitizeRecurringRuleDraft,
} from "../features/growth/recurring.js";
import {
  clearSavingsForm,
  readSavingsForm,
  renderSavingsGoalForm,
  renderSavingsGoalsSection,
  sanitizeSavingsGoalDraft,
} from "../features/growth/savings.js";

function createDefaultFilters() {
  return {
    preset: "today",
    accountId: "all",
    type: "all",
    categoryKey: "all",
    scopeId: "all",
    date: getTodayInputValue(),
    search: "",
  };
}

function createDefaultReportState() {
  const filters = buildDefaultReportFilters();
  return {
    draft: { ...filters },
    applied: { ...filters },
  };
}

function createDefaultLoanPartyDraft() {
  return buildLoanPartyDraft();
}

function createDefaultLoanEntryDraft() {
  return buildLoanEntryDraft();
}

const reportDefaults = createDefaultReportState();

const state = {
  currentUser: null,
  pendingRoute: "home",
  expensesView: "ledger",
  month: getCurrentYm(),
  accounts: [],
  transactions: [],
  monthTransactions: [],
  transactionsByMonth: {},
  expenseScopes: [],
  expenseCategories: [],
  scopeBudgets: [],
  scopeBudgetsMonth: "",
  loanParties: [],
  loanTransactions: [],
  loansLoaded: false,
  reportsDataLoaded: false,
  reportAiInsightText: "",
  reportAiLoading: false,
  homeDailyFlowLoaded: false,
  homeMomLoaded: false,
  financeMonthLoaded: false,
  reportsMomLoaded: false,
  reportPreviousTransactions: [],
  loanSelectedPartyId: "",
  filters: createDefaultFilters(),
  composerDraft: buildTransactionDraft(),
  loanPartyDraft: createDefaultLoanPartyDraft(),
  loanEntryDraft: createDefaultLoanEntryDraft(),
  loanEntryContext: { visible: false },
  expenseScopeDraft: {
    mode: "rename",
    id: "",
    name: "",
    replacementScopeId: "",
  },
  expenseCategoryDraft: {
    mode: "rename",
    id: "",
    name: "",
    replacementCategoryId: "",
  },
  financeVm: null,
  loansVm: null,
  reportFilters: reportDefaults.draft,
  reportAppliedFilters: reportDefaults.applied,
  reportTransactions: [],
  reportVm: null,
  reportError: "",
  reportLoadedKey: "",
  homeVm: null,
  homeLoadedKey: "",
  homeAccountFilter: "all",
  homePreviousMonthTransactions: [],
  recurringRules: [],
  savingsGoals: [],
};

function byId(id) {
  return document.getElementById(id);
}

function getModal(id) {
  const el = byId(id);
  if (!el) return null;
  return bootstrap.Modal.getOrCreateInstance(el);
}

function openModal(id) {
  getModal(id)?.show();
}

function closeModal(id) {
  getModal(id)?.hide();
}

function getReplacementScopeId(currentScopeId = "", requestedId = "") {
  const requested = String(requestedId || "").trim();
  const currentId = String(currentScopeId || "").trim();
  const options = state.expenseScopes.filter((item) => String(item?.id || "").trim() !== currentId);
  if (requested && options.some((item) => String(item?.id || "").trim() === requested)) {
    return requested;
  }
  return String(options[0]?.id || "").trim();
}

function buildExpenseScopeDraft(payload = {}) {
  const mode = String(payload?.mode || "rename").trim() === "delete" ? "delete" : "rename";
  const id = String(payload?.id || "").trim();
  return {
    mode,
    id,
    name: String(payload?.name || "").trim(),
    replacementScopeId: getReplacementScopeId(id, payload?.replacementScopeId),
  };
}

function openExpenseScopePanel(draft = {}) {
  state.expenseScopeDraft = buildExpenseScopeDraft(draft);
  renderExpenseScopeForm({
    draft: state.expenseScopeDraft,
    expenseScopes: state.expenseScopes,
  });
  openModal("financeScopePanel");
}

function clearExpenseScopeInput() {
  const input = byId("expenseScopeName");
  if (input) input.value = "";
}

function findExpenseScopeByRef(rawValue = "") {
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  return (
    state.expenseScopes.find((item) => String(item?.id || "").trim() === text) ||
    state.expenseScopes.find((item) => String(item?.name || "").trim().toLowerCase() === lower) ||
    null
  );
}

function getReplacementCategoryId(currentCategoryId = "", requestedId = "") {
  const requested = String(requestedId || "").trim();
  const currentId = String(currentCategoryId || "").trim();
  const options = state.expenseCategories.filter(
    (item) =>
      String(item?.id || "").trim() !== currentId && !String(item?.parentId || "").trim()
  );
  if (requested && options.some((item) => String(item?.id || "").trim() === requested)) {
    return requested;
  }
  return String(options[0]?.id || "").trim();
}

function buildExpenseCategoryDraft(payload = {}) {
  const mode = String(payload?.mode || "rename").trim() === "delete" ? "delete" : "rename";
  const id = String(payload?.id || "").trim();
  return {
    mode,
    id,
    name: String(payload?.name || "").trim(),
    replacementCategoryId: getReplacementCategoryId(id, payload?.replacementCategoryId),
  };
}

function openExpenseCategoryPanel(draft = {}) {
  state.expenseCategoryDraft = buildExpenseCategoryDraft(draft);
  renderExpenseCategoryForm({
    draft: state.expenseCategoryDraft,
    expenseCategories: state.expenseCategories,
  });
  openModal("financeCategoryPanel");
}

function clearExpenseCategoryInput() {
  const input = byId("expenseCategoryName");
  if (input) input.value = "";
}

function findExpenseCategoryByRef(rawValue = "") {
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  return (
    state.expenseCategories.find((item) => String(item?.id || "").trim() === text) ||
    state.expenseCategories.find((item) => String(item?.key || "").trim() === text) ||
    state.expenseCategories.find((item) => String(item?.name || "").trim().toLowerCase() === lower) ||
    null
  );
}

function getCurrentHashRoute() {
  return String(location.hash || "").replace("#", "").trim();
}

function resolveWorkspaceRoute(routeId = "") {
  const raw = String(routeId || "").trim();
  if (raw === "overview" || raw === "dashboard") return "home";
  if (raw === "expenses" || raw.startsWith("expenses/")) return "expenses";
  return raw || "home";
}

function syncExpensesViewFromHash() {
  const parsed = parseHashRoute(getCurrentHashRoute());
  state.expensesView = parsed.expensesView === "manage" ? "manage" : "ledger";
}

function getHomeLoadKey(monthKey = getCurrentYm()) {
  return String(monthKey || getCurrentYm()).trim() || getCurrentYm();
}

function invalidateHomeCache() {
  state.homeLoadedKey = "";
}

function getReportLoadKey(filters = state.reportAppliedFilters) {
  return JSON.stringify(normalizeReportFilters(filters));
}

function invalidateReportsCache() {
  state.reportLoadedKey = "";
  state.reportsMomLoaded = false;
  state.reportPreviousTransactions = [];
  invalidateHomeCache();
}

function invalidateFinanceMonthCache(monthKey = "") {
  const normalizedMonth = String(monthKey || "").trim();
  if (!normalizedMonth) {
    state.transactionsByMonth = {};
    return;
  }

  delete state.transactionsByMonth[normalizedMonth];
}

function getTransactionsForMonth(monthKey = state.month) {
  return state.transactionsByMonth[String(monthKey || "").trim()] || [];
}

async function ensureFinanceMonthResources(uid, monthKey = state.month) {
  const normalizedMonth = String(monthKey || "").trim() || getCurrentYm();

  if (!state.transactionsByMonth[normalizedMonth]) {
    const items = await listTransactions(uid, { month: normalizedMonth });
    state.transactionsByMonth[normalizedMonth] = items;
  }

  return {
    transactions: getTransactionsForMonth(normalizedMonth),
  };
}

function ensureMonthValue(value = "") {
  const next = String(value || "").trim() || getCurrentYm();
  state.month = next;
}

function normalizeDateFilterForMonth(month = state.month) {
  const currentDate = String(state.filters?.date || "").trim();
  if (!currentDate) {
    state.filters.date = getTodayInputValue();
  }
}

function ensureUser() {
  const uid = String(state.currentUser?.uid || "").trim();
  if (!uid) {
    showToast(t("toast.signInRequired", "Vui lòng đăng nhập trước."), "info");
    return "";
  }
  return uid;
}

function updateMenuState(user) {
  const resetEl = byId("menu-reset");
  if (resetEl) resetEl.classList.toggle("d-none", !user);
}

function getFinanceTransactionsForVm() {
  if (String(state.filters?.preset || "").trim() === "month" && !state.financeMonthLoaded) {
    return [];
  }
  return state.transactions;
}

function applyFinanceLedgerFromCache() {
  const normalizedMonth = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  const monthTransactions = state.transactionsByMonth[normalizedMonth] || state.monthTransactions || [];
  const preset = String(state.filters?.preset || "today").trim();

  if (preset === "month" && state.financeMonthLoaded) {
    const financeRange = getFinanceRange(state.filters);
    state.transactions = filterTransactionsByDateRange(
      monthTransactions,
      financeRange.fromDate,
      financeRange.toDate
    );
    return;
  }

  if (preset === "today") {
    const todayRange = getFinanceRange({ ...state.filters, preset: "today" });
    state.transactions = filterTransactionsByDateRange(
      monthTransactions,
      todayRange.fromDate,
      todayRange.toDate
    );
    return;
  }

  const financeRange = getFinanceRange(state.filters);
  state.transactions = filterTransactionsByDateRange(
    monthTransactions,
    financeRange.fromDate,
    financeRange.toDate
  );
}

function buildRenderedFinanceVm() {
  const vm = buildFinanceVm({
    month: state.month,
    accounts: state.accounts,
    transactions: getFinanceTransactionsForVm(),
    expenseScopes: state.expenseScopes,
    expenseCategories: state.expenseCategories,
    filters: state.filters,
  });
  vm.summary.totalBalanceText = formatCurrency(vm.summary.totalBalance);
  vm.summary.incomeTotalText = formatCurrency(vm.summary.incomeTotal);
  vm.summary.expenseTotalText = formatCurrency(vm.summary.expenseTotal);
  vm.summary.transferTotalText = formatCurrency(vm.summary.transferTotal);
  vm.summary.netTotalText = formatCurrency(vm.summary.netTotal);
  return vm;
}

function buildRenderedLoansVm() {
  return buildLoansVm({
    accounts: state.accounts,
    parties: state.loanParties,
    transactions: state.loanTransactions,
    selectedPartyId: state.loanSelectedPartyId,
  });
}

function renderFinanceView() {
  syncExpensesViewFromHash();
  state.financeVm = buildRenderedFinanceVm();
  const scopeBudgetPanel = buildScopeBudgetPanel({
    expenseScopes: state.expenseScopes,
    scopeBudgets: state.scopeBudgets,
    monthTransactions: state.monthTransactions,
    monthKey: state.month,
  });
  renderFinanceRoute(state.financeVm, state.expensesView, {
    financeMonthLoaded: state.financeMonthLoaded,
    scopeBudgetPanel,
  });
  syncFilterControls();
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    expenseCategories: state.expenseCategories,
  });

  const infoEl = byId("financeWorkspaceInfo");
  if (infoEl) {
    const range = state.financeVm?.range || {};
    const rangeLabel = String(range?.presetLabel || "").trim();
    const anchorDate = String(state.financeVm?.filters?.date || "").trim();
    infoEl.textContent =
      range?.preset === "month" && !state.financeMonthLoaded
        ? t(
            "finance.monthLoadWorkspaceInfo",
            "Đang tải giao dịch tháng này… Nếu chưa hiện, bấm Tải giao dịch tháng."
          )
        : range?.preset === "month"
          ? `Theo dõi giao dịch trong ${rangeLabel.toLowerCase()}.`
          : `Theo dõi ${rangeLabel.toLowerCase()} kết thúc vào ${formatDateLabel(anchorDate)}.`;
  }
  renderExpenseScopeForm({
    draft: state.expenseScopeDraft,
    expenseScopes: state.expenseScopes,
  });
  renderExpenseCategoryForm({
    draft: state.expenseCategoryDraft,
    expenseCategories: state.expenseCategories,
  });
}

function renderLoanEntryView() {
  renderLoanEntryForm({
    draft: state.loanEntryDraft,
    parties: state.loansVm?.partyOptions || [],
    accounts: state.loansVm?.accountOptions || [],
    context: state.loanEntryContext,
  });
}

function renderLoansView() {
  if (state.loansLoaded) {
    state.loansVm = buildRenderedLoansVm();
    state.loanSelectedPartyId = state.loansVm?.selectedPartyId || "";
  }
  renderLoansRoute(state.loansVm, {
    loansDataLoaded: state.loansLoaded,
    partiesFallback: state.loanParties,
    selectedPartyId: state.loanSelectedPartyId,
  });
  renderLoanPartyForm({
    draft: state.loanPartyDraft,
  });
  renderLoanEntryView();
  syncLoansNavBadge();
}

function syncLoansNavBadge() {
  let count = Number(state.loansVm?.summary?.activePartyCount || 0);
  if (!count && state.loanParties.length && state.loanTransactions.length) {
    const vm = buildLoansVm({
      accounts: state.accounts,
      parties: state.loanParties,
      transactions: state.loanTransactions,
      selectedPartyId: state.loanSelectedPartyId,
    });
    count = Number(vm?.summary?.activePartyCount || 0);
  }
  document.querySelectorAll("[data-loans-badge]").forEach((el) => {
    const show = count > 0;
    el.textContent = String(count);
    el.classList.toggle("d-none", !show);
    el.setAttribute("aria-hidden", show ? "false" : "true");
  });
}

function renderGrowthPanels() {
  renderRecurringSection({
    rules: state.recurringRules,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    expenseCategories: state.expenseCategories,
  });
  renderSavingsGoalsSection(state.savingsGoals);
}

function renderHomeView() {
  if (!state.homeVm) return;
  renderHomeRoute(state.homeVm);
  renderSavingsGoalsSection(state.savingsGoals);
}

function getHomeMonthTransactions() {
  return (
    state.monthTransactions ||
    state.transactionsByMonth[String(state.month || "").trim()] ||
    []
  );
}

function syncTopbarStatsForActiveRoute() {
  const route = resolveWorkspaceRoute(getCurrentHashRoute() || state.pendingRoute || "home");

  if (route === "expenses" && state.financeVm?.summary) {
    updateNavbarStats({
      expenseTotal: state.financeVm.summary.expenseTotal,
      incomeTotal: state.financeVm.summary.incomeTotal,
      balanceTotal: state.financeVm.summary.totalBalance,
    });
    return;
  }

  if (state.homeVm?.navbar) {
    updateNavbarStats(state.homeVm.navbar);
    return;
  }

  if (state.financeVm?.summary) {
    updateNavbarStats({
      expenseTotal: state.financeVm.summary.expenseTotal,
      incomeTotal: state.financeVm.summary.incomeTotal,
      balanceTotal: state.financeVm.summary.totalBalance,
    });
  }
}

function buildReportsMomBlock() {
  if (!state.reportsDataLoaded) {
    return { loadPending: true };
  }
  if (!state.reportsMomLoaded) {
    return {
      loadPending: true,
      emptyTitle: t("reports.momLoadTitle", "So với kỳ trước"),
      emptyBody: t("reports.momLoadBody", "Bấm để so sánh chi, thu và còn lại với kỳ liền trước."),
    };
  }

  const prevFilters = buildPreviousReportFilters(state.reportAppliedFilters);
  const comparison = buildReportMomComparison(state.reportTransactions, state.reportPreviousTransactions);
  return {
    ...comparison,
    prevRangeLabel: `${formatDateLabel(prevFilters.fromDate)} - ${formatDateLabel(prevFilters.toDate)}`,
  };
}

function rebuildHomeVm() {
  if (!state.accounts.length) return;
  state.homeVm = buildHomeVm({
    monthKey: state.month,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    currentMonthTransactions: getHomeMonthTransactions(),
    previousMonthTransactions: state.homePreviousMonthTransactions,
    loanParties: state.loanParties,
    loanTransactions: state.loansLoaded ? state.loanTransactions : [],
    loansDataLoaded: state.loansLoaded,
    includeDailyFlow: true,
    includeMomComparison: state.homeMomLoaded,
    accountId: state.homeAccountFilter,
  });
  renderHomeView();
  syncTopbarStatsForActiveRoute();
}

function renderReportsView() {
  const vm =
    state.reportVm ||
    buildFinanceReportVm({
      filters: state.reportAppliedFilters,
      accounts: state.accounts,
      transactions: state.reportTransactions,
      expenseScopes: state.expenseScopes,
    });

  vm.momComparison = buildReportsMomBlock();

  renderReportsRoute(vm, {
    draftFilters: state.reportFilters,
    error: state.reportError,
    activePreset: resolveReportPreset(state.reportAppliedFilters),
    reportsDataLoaded: state.reportsDataLoaded,
    aiEnabled: false,
    aiInsightText: state.reportAiInsightText,
    aiLoading: state.reportAiLoading,
  });
  syncFilterControls();
}

function renderApp() {
  renderHomeView();
  renderFinanceView();
  renderLoansView();
  renderReportsView();
  renderGrowthPanels();
  syncTopbarStatsForActiveRoute();
}

function renderComposerView() {
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    expenseCategories: state.expenseCategories,
  });
}

function openLoanPartyPanel(party = null) {
  state.loanPartyDraft = buildLoanPartyDraft(party);
  renderLoanPartyForm({
    draft: state.loanPartyDraft,
  });
  openModal("loanPartyPanel");
}

function openLoanEntryPanel(type = "loan_lend", options = {}) {
  const entryId = String(options?.entryId || "").trim();
  const transaction = entryId
    ? state.loanTransactions.find((item) => String(item?.id || "").trim() === entryId) || null
    : null;

  state.loanEntryDraft = buildLoanEntryDraft({
    accounts: state.accounts,
    parties: state.loanParties,
    transaction,
    type,
    presetPartyId: options?.partyId || state.loanSelectedPartyId,
  });
  state.loanEntryContext = buildLoanEntryContext({
    draft: state.loanEntryDraft,
    parties: state.loanParties,
    transactions: state.loanTransactions,
  });
  renderLoanEntryView();
  openModal("loanEntryPanel");
}

function syncLoanEntryDraft(nextDraft = {}) {
  state.loanEntryDraft = {
    ...state.loanEntryDraft,
    ...nextDraft,
  };
  state.loanEntryContext = buildLoanEntryContext({
    draft: state.loanEntryDraft,
    parties: state.loanParties,
    transactions: state.loanTransactions,
  });
  renderLoanEntryView();
}

function resetRuntimeState() {
  const defaultReportState = createDefaultReportState();
  state.accounts = [];
  state.transactions = [];
  state.monthTransactions = [];
  state.transactionsByMonth = {};
  state.expenseScopes = [];
  state.expenseCategories = [];
  setExpenseCategoryCache([]);
  state.scopeBudgets = [];
  state.scopeBudgetsMonth = "";
  state.loanParties = [];
  state.loanTransactions = [];
  state.loansLoaded = false;
  state.reportsDataLoaded = false;
  state.reportAiInsightText = "";
  state.reportAiLoading = false;
  state.homeDailyFlowLoaded = false;
  state.homeMomLoaded = false;
  state.financeMonthLoaded = false;
  state.reportsMomLoaded = false;
  state.reportPreviousTransactions = [];
  state.loanSelectedPartyId = "";
  state.filters = createDefaultFilters();
  state.composerDraft = buildTransactionDraft();
  state.expensesView = "ledger";
  state.loanPartyDraft = createDefaultLoanPartyDraft();
  state.loanEntryDraft = createDefaultLoanEntryDraft();
  state.loanEntryContext = { visible: false };
  state.expenseScopeDraft = buildExpenseScopeDraft();
  state.expenseCategoryDraft = buildExpenseCategoryDraft();
  state.financeVm = null;
  state.loansVm = null;
  state.reportFilters = defaultReportState.draft;
  state.reportAppliedFilters = defaultReportState.applied;
  state.reportTransactions = [];
  state.reportVm = null;
  state.reportError = "";
  state.reportLoadedKey = "";
  state.homeVm = null;
  state.homeLoadedKey = "";
  state.homeAccountFilter = "all";
  state.homePreviousMonthTransactions = [];
  state.recurringRules = [];
  state.savingsGoals = [];
  ensureMonthValue(getYmFromDateInput(state.filters.date) || getCurrentYm());
  clearExpenseScopeInput();
  renderApp();
}

function normalizeWorkspaceAfterFetch() {
  if (
    state.filters.accountId !== "all" &&
    !state.accounts.some((item) => String(item?.id || "").trim() === state.filters.accountId)
  ) {
    state.filters.accountId = "all";
  }

  if (
    state.filters.scopeId !== "all" &&
    !state.expenseScopes.some((item) => String(item?.id || "").trim() === state.filters.scopeId)
  ) {
    state.filters.scopeId = "all";
  }

  if (
    state.filters.categoryKey !== "all" &&
    !state.expenseCategories.some((item) => {
      const key = String(item?.key || item?.id || "").trim();
      const legacy = String(item?.legacyKey || "").trim();
      return key === state.filters.categoryKey || legacy === state.filters.categoryKey;
    })
  ) {
    state.filters.categoryKey = "all";
  }

  if (
    !String(state.composerDraft?.accountId || "").trim() ||
    !state.accounts.some(
      (item) => String(item?.id || "").trim() === String(state.composerDraft?.accountId || "").trim()
    )
  ) {
    state.composerDraft = buildTransactionDraft({
      accounts: state.accounts,
      type: state.composerDraft?.type || "expense",
    });
  }

  if (
    state.composerDraft?.type === "expense" &&
    state.composerDraft?.scopeId &&
    !state.expenseScopes.some(
      (item) => String(item?.id || "").trim() === String(state.composerDraft?.scopeId || "").trim()
    )
  ) {
    state.composerDraft = {
      ...state.composerDraft,
      scopeId: "",
    };
  }

  if (
    state.composerDraft?.type === "expense" &&
    state.composerDraft?.categoryKey &&
    !state.expenseCategories.some((item) => {
      const key = String(item?.key || item?.id || "").trim();
      const legacy = String(item?.legacyKey || "").trim();
      const draftKey = String(state.composerDraft?.categoryKey || "").trim();
      return key === draftKey || legacy === draftKey || String(item?.id || "").trim() === draftKey;
    })
  ) {
    const fallback =
      state.expenseCategories.find((item) => String(item?.key || "").trim() === "other") ||
      state.expenseCategories[0];
    state.composerDraft = {
      ...state.composerDraft,
      categoryKey: String(fallback?.key || fallback?.id || "other").trim(),
    };
  }

  state.homeAccountFilter = normalizeHomeAccountFilter(state.homeAccountFilter, state.accounts);
}

function rebuildLoansVmOnly() {
  state.loansVm = buildRenderedLoansVm();
  state.loanSelectedPartyId = state.loansVm?.selectedPartyId || "";
  state.loanEntryContext = buildLoanEntryContext({
    draft: state.loanEntryDraft,
    parties: state.loanParties,
    transactions: state.loanTransactions,
  });
}

function rebuildReportsVm() {
  state.reportVm = buildFinanceReportVm({
    filters: state.reportAppliedFilters,
    accounts: state.accounts,
    transactions: state.reportTransactions,
    expenseScopes: state.expenseScopes,
  });
  state.reportVm.momComparison = buildReportsMomBlock();
  state.reportLoadedKey = getReportLoadKey(state.reportAppliedFilters);
}

function rebuildCoreViewModels() {
  state.homeVm = buildHomeVm({
    monthKey: state.month,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    currentMonthTransactions: getHomeMonthTransactions(),
    previousMonthTransactions: state.homePreviousMonthTransactions,
    loanParties: state.loanParties,
    loanTransactions: state.loansLoaded ? state.loanTransactions : [],
    loansDataLoaded: state.loansLoaded,
    includeDailyFlow: true,
    includeMomComparison: state.homeMomLoaded,
    accountId: state.homeAccountFilter,
  });
  state.homeLoadedKey = getHomeLoadKey(state.month);
  state.financeVm = buildRenderedFinanceVm();

  if (state.loansLoaded) {
    rebuildLoansVmOnly();
  } else {
    state.loansVm = null;
  }

  if (state.reportsDataLoaded) {
    rebuildReportsVm();
  } else {
    state.reportVm = null;
    state.reportLoadedKey = "";
  }
}

function financeRangeCanUseMonthCache(financeRange = {}, monthKey = "") {
  const preset = String(financeRange?.preset || "").trim();
  const rangeMonth = getYmFromDateInput(financeRange?.fromDate);
  return (preset === "month" || preset === "today") && rangeMonth === monthKey;
}

function resolveReportTransactionsFromCache(
  reportFilters = {},
  monthTransactions = [],
  previousMonthTransactions = [],
  workspaceMonth = ""
) {
  const normalized = normalizeReportFilters(reportFilters);
  const currentDefault = buildDefaultReportFilters(getCurrentYm());
  const previousDefault = buildDefaultReportFilters(prevYm(getCurrentYm()));

  if (
    normalized.fromDate === currentDefault.fromDate &&
    normalized.toDate === currentDefault.toDate &&
    normalized.month === currentDefault.month &&
    normalized.month === workspaceMonth
  ) {
    return filterTransactionsByDateRange(monthTransactions, normalized.fromDate, normalized.toDate);
  }

  if (
    normalized.fromDate === previousDefault.fromDate &&
    normalized.toDate === previousDefault.toDate &&
    normalized.month === previousDefault.month
  ) {
    return previousMonthTransactions;
  }

  if (normalized.month === workspaceMonth) {
    return filterTransactionsByDateRange(monthTransactions, normalized.fromDate, normalized.toDate);
  }

  if (normalized.month === prevYm(workspaceMonth)) {
    return filterTransactionsByDateRange(previousMonthTransactions, normalized.fromDate, normalized.toDate);
  }

  return null;
}

async function loadCoreWorkspaceTransactions(uid, { normalizedMonth }) {
  const monthTransactions = await listTransactions(uid, { month: normalizedMonth });
  return { monthTransactions };
}

async function loadFinanceMonthData(uid) {
  const normalizedMonth = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  let monthTransactions = state.transactionsByMonth[normalizedMonth] || state.monthTransactions || [];

  if (!monthTransactions.length) {
    monthTransactions = await listTransactions(uid, { month: normalizedMonth });
    state.transactionsByMonth[normalizedMonth] = monthTransactions;
    state.monthTransactions = monthTransactions;
  } else {
    state.monthTransactions = monthTransactions;
  }

  state.financeMonthLoaded = true;
  applyFinanceLedgerFromCache();
  state.financeVm = buildRenderedFinanceVm();
  if (state.expensesView === "manage") {
    try {
      await loadScopeBudgetsForMonth(uid, normalizedMonth);
    } catch (err) {
      console.error("load scope budgets error", err);
    }
  }
  rebuildHomeVm();
  renderFinanceView();
  syncTopbarStatsForActiveRoute();
}

async function loadScopeBudgetsForMonth(uid, monthKey = state.month) {
  const normalizedMonth = String(monthKey || getCurrentYm()).trim() || getCurrentYm();
  if (state.scopeBudgetsMonth === normalizedMonth && Array.isArray(state.scopeBudgets)) {
    return state.scopeBudgets;
  }

  const items = await listScopeBudgets(uid, normalizedMonth);
  state.scopeBudgets = items;
  state.scopeBudgetsMonth = normalizedMonth;
  return items;
}

async function ensureManageScopeBudgets(uid) {
  if (!uid || state.expensesView !== "manage") return;
  const monthKey = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  if (!state.financeMonthLoaded) {
    await loadFinanceMonthData(uid);
    return;
  }
  await loadScopeBudgetsForMonth(uid, monthKey);
  renderFinanceView();
}

async function loadHomeMomData(uid) {
  const normalizedMonth = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  const prevMonthKey = prevYm(normalizedMonth);

  if (!state.homePreviousMonthTransactions.length) {
    state.homePreviousMonthTransactions = await listTransactions(uid, { month: prevMonthKey });
  }

  state.homeMomLoaded = true;
  rebuildHomeVm();
}

async function loadReportsMomData(uid) {
  const prevFilters = buildPreviousReportFilters(state.reportAppliedFilters);
  const prevMonthKey = String(prevFilters.month || prevYm(getCurrentYm())).trim();
  let monthTransactions = state.transactionsByMonth[prevMonthKey] || [];

  if (!monthTransactions.length && state.homeMomLoaded && prevMonthKey === prevYm(state.month)) {
    monthTransactions = state.homePreviousMonthTransactions;
  }

  if (!monthTransactions.length) {
    monthTransactions = await listTransactions(uid, { month: prevMonthKey });
    state.transactionsByMonth[prevMonthKey] = monthTransactions;
  }

  state.reportPreviousTransactions = filterTransactionsByDateRange(
    monthTransactions,
    prevFilters.fromDate,
    prevFilters.toDate
  );
  state.reportsMomLoaded = true;
  rebuildReportsVm();
  renderReportsView();
  syncTopbarStatsForActiveRoute();
}

async function navigateReportDrillDown(kind = "", key = "") {
  const uid = ensureUser();
  if (!uid || !state.reportsDataLoaded) return;

  const drillKind = String(kind || "").trim();
  const drillKey = String(key || "").trim();
  if (!drillKind || !drillKey) return;

  const applied = normalizeReportFilters(state.reportAppliedFilters);
  const monthKey = getYmFromDateInput(applied.fromDate) || state.month;

  state.filters = {
    ...state.filters,
    preset: "month",
    date: applied.fromDate,
    accountId: drillKind === "account" ? drillKey : applied.accountId || "all",
    categoryKey: drillKind === "category" ? drillKey : "all",
    scopeId: drillKind === "scope" ? drillKey : "all",
    type: drillKind === "category" || drillKind === "scope" ? "expense" : "all",
    search: "",
  };

  setGlobalLoading(true);
  try {
    if (monthKey !== state.month) {
      ensureMonthValue(monthKey);
      await refreshFinance(uid, { month: monthKey, resetFinanceMonth: true });
    }

    if (!state.financeMonthLoaded) {
      await loadFinanceMonthData(uid);
    } else {
      applyFinanceLedgerFromCache();
      state.financeVm = buildRenderedFinanceVm();
    }

    state.expensesView = "ledger";
    state.pendingRoute = "expenses";
    setActiveRoute("expenses");
    if (!String(window.location.hash || "").startsWith("#expenses")) {
      window.location.hash = "#expenses";
    }
    renderFinanceView();
    syncTopbarStatsForActiveRoute();
  } catch (err) {
    console.error("report drill-down error", err);
    showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
  } finally {
    setGlobalLoading(false);
  }
}

async function fetchReportTransactions(uid, reportFilters = state.reportAppliedFilters) {
  const normalizedMonth = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  const normalized = normalizeReportFilters(reportFilters);
  const monthTransactions = state.transactionsByMonth[normalizedMonth] || state.monthTransactions || [];

  let reportTransactions = resolveReportTransactionsFromCache(
    normalized,
    monthTransactions,
    state.homePreviousMonthTransactions,
    normalizedMonth
  );

  if (reportTransactions) return reportTransactions;

  const previousDefault = buildDefaultReportFilters(prevYm(getCurrentYm()));
  if (normalized.month === previousDefault.month && !state.homePreviousMonthTransactions.length) {
    const previousMonthTransactions = await listTransactions(uid, { month: normalized.month });
    state.homePreviousMonthTransactions = previousMonthTransactions;
    return filterTransactionsByDateRange(previousMonthTransactions, normalized.fromDate, normalized.toDate);
  }

  return listTransactions(uid, {
    fromDate: normalized.fromDate,
    toDate: normalized.toDate,
  });
}

async function refreshWorkspaceCore(uid) {
  state.filters = {
    ...createDefaultFilters(),
    ...state.filters,
  };

  const normalizedMonth = String(state.month || getCurrentYm()).trim() || getCurrentYm();
  ensureMonthValue(normalizedMonth);
  normalizeDateFilterForMonth(normalizedMonth);

  const [accounts, expenseScopes, expenseCategories, loanParties, coreTransactions, recurringRules, savingsGoals] =
    await Promise.all([
      listAccountsWithBalances(uid),
      listExpenseScopes(uid),
      listExpenseCategories(uid).catch(() => []),
      listLoanParties(uid),
      loadCoreWorkspaceTransactions(uid, { normalizedMonth }),
      listRecurringRules(uid).catch(() => []),
      listSavingsGoals(uid).catch(() => []),
    ]);

  const { monthTransactions } = coreTransactions;

  state.accounts = accounts;
  state.expenseScopes = expenseScopes;
  state.expenseCategories = Array.isArray(expenseCategories) ? expenseCategories : [];
  setExpenseCategoryCache(state.expenseCategories);
  state.monthTransactions = monthTransactions;
  state.transactionsByMonth[normalizedMonth] = monthTransactions;
  state.loanParties = loanParties;
  state.recurringRules = Array.isArray(recurringRules) ? recurringRules : [];
  state.savingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];

  normalizeWorkspaceAfterFetch();
  applyFinanceLedgerFromCache();

  const optionalLoads = [];
  if (state.loansLoaded) {
    optionalLoads.push(
      listLoanTransactions(uid).then((items) => {
        state.loanTransactions = items;
      })
    );
  }
  if (state.reportsDataLoaded) {
    optionalLoads.push(
      fetchReportTransactions(uid, state.reportAppliedFilters).then((items) => {
        state.reportTransactions = items;
      })
    );
  }
  if (optionalLoads.length) await Promise.all(optionalLoads);

  rebuildCoreViewModels();
  renderApp();
  maybeToastRecurringDue();
}

async function refreshWorkspaceData(uid) {
  await refreshWorkspaceCore(uid);
}

async function refreshFinance(uid, { month = state.month, resetFinanceMonth = true } = {}) {
  const budgetMonth = getYmFromDateInput(state.filters.date) || month || getCurrentYm();
  ensureMonthValue(budgetMonth);
  if (resetFinanceMonth) {
    state.financeMonthLoaded = false;
    state.homeMomLoaded = false;
    state.homePreviousMonthTransactions = [];
    state.scopeBudgets = [];
    state.scopeBudgetsMonth = "";
  }
  await refreshWorkspaceData(uid);
  if (state.expensesView === "manage") {
    try {
      await ensureManageScopeBudgets(uid);
    } catch (err) {
      console.error("ensure manage scope budgets error", err);
    }
  }
}

async function refreshLoans(uid) {
  if (!state.accounts.length) {
    await refreshWorkspaceCore(uid);
  }

  state.loanTransactions = await listLoanTransactions(uid);
  state.loansLoaded = true;
  rebuildLoansVmOnly();
  rebuildHomeVm();
  renderLoansView();
  syncTopbarStatsForActiveRoute();
}

async function refreshHome(uid, monthKey = getCurrentYm()) {
  const normalizedMonth = String(monthKey || getCurrentYm()).trim() || getCurrentYm();
  ensureMonthValue(normalizedMonth);
  await refreshWorkspaceData(uid);
}

async function refreshReports(uid, filters = state.reportAppliedFilters) {
  if (!state.accounts.length) {
    await refreshWorkspaceCore(uid);
  }

  state.reportAppliedFilters = normalizeReportFilters(filters);
  state.reportsMomLoaded = false;
  state.reportPreviousTransactions = [];
  state.reportAiInsightText = "";
  state.reportAiLoading = false;
  state.reportTransactions = await fetchReportTransactions(uid, state.reportAppliedFilters);
  state.reportsDataLoaded = true;
  rebuildReportsVm();
  renderReportsView();
  syncTopbarStatsForActiveRoute();
}

function exportReportCsv() {
  if (!state.reportsDataLoaded) return;

  try {
    const content = buildReportCsvContent({
      transactions: state.reportTransactions,
      accounts: state.accounts,
      expenseScopes: state.expenseScopes,
      filters: state.reportAppliedFilters,
    });
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fromDate = String(state.reportAppliedFilters?.fromDate || state.month || "report").trim();
    const toDate = String(state.reportAppliedFilters?.toDate || "").trim();
    link.href = url;
    link.download = `report-${fromDate}${toDate ? `_to_${toDate}` : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(t("toast.reportCsvExportSuccess", "Đã xuất CSV kỳ báo cáo."), "success");
  } catch (err) {
    console.error("export report csv error", err);
    showToast(t("toast.reportCsvExportFail", "Không thể xuất CSV báo cáo."), "error");
  }
}

async function requestAiReportInsights() {
  return;
}

function findTransactionById(transactionId = "") {
  const id = String(transactionId || "").trim();
  if (!id) return null;
  const direct = state.transactions.find((item) => String(item?.id || "").trim() === id);
  if (direct) return direct;
  for (const items of Object.values(state.transactionsByMonth || {})) {
    const match = (Array.isArray(items) ? items : []).find((item) => String(item?.id || "").trim() === id);
    if (match) return match;
  }
  const loanMatch = state.loanTransactions.find((item) => String(item?.id || "").trim() === id);
  if (loanMatch) return loanMatch;
  return null;
}

function maybeToastRecurringDue() {
  const today = new Date();
  const day = today.getDate();
  if (day > 28) return;
  const due = (state.recurringRules || []).filter(
    (rule) => rule?.active !== false && Number(rule?.dayOfMonth || 0) === day
  );
  if (!due.length) return;

  const key = `htf-recurring-toast:${state.currentUser?.uid || ""}:${getTodayInputValue()}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }

  showToast(
    formatTemplate(t("recurring.dueToast", "Có {{count}} khoản định kỳ hôm nay — mở Quản lý để tạo."), {
      count: due.length,
    }),
    "info"
  );
}

function openGlobalSearchPanel() {
  if (!ensureUser()) return;
  renderGlobalSearchResults(byId("globalSearchResults"), [], "");
  openModal("globalSearchPanel");
  queueMicrotask(() => {
    const input = byId("globalSearch");
    if (!input) return;
    input.value = "";
    input.focus();
    input.select?.();
  });
}

function runGlobalSearch(query = "") {
  const results = buildGlobalSearchResults({
    query,
    transactions: state.transactions,
    transactionsByMonth: state.transactionsByMonth,
    loanTransactions: state.loanTransactions,
    loanParties: state.loanParties,
    accounts: state.accounts,
  });
  renderGlobalSearchResults(byId("globalSearchResults"), results, query);
}

async function handleGlobalSearchSelect(button) {
  const kind = String(button?.getAttribute("data-search-kind") || "").trim();
  const id = String(button?.getAttribute("data-search-id") || "").trim();
  const partyId = String(button?.getAttribute("data-search-party-id") || "").trim();
  if (!kind || !id) return;

  closeModal("globalSearchPanel");

  if (kind === "loan_party" || kind === "loan_tx") {
    const uid = ensureUser();
    if (!uid) return;
    if (!state.loansLoaded) {
      setGlobalLoading(true);
      try {
        await refreshLoans(uid);
      } catch (err) {
        console.error("load loans for search error", err);
        showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
      } finally {
        setGlobalLoading(false);
      }
    }
    state.loanSelectedPartyId = kind === "loan_party" ? id : partyId || state.loanSelectedPartyId;
    state.pendingRoute = "loans";
    setActiveRoute("loans");
    if (!String(window.location.hash || "").startsWith("#loans")) {
      window.location.hash = "#loans";
    }
    rebuildLoansVmOnly();
    renderLoansView();
    if (kind === "loan_tx") {
      const tx = findTransactionById(id);
      openLoanEntryPanel(tx?.type || "loan_lend", { entryId: id, partyId: state.loanSelectedPartyId });
    }
    return;
  }

  const tx = findTransactionById(id);
  if (!tx) {
    showToast(t("search.notFound", "Không tìm thấy giao dịch trong bộ nhớ đệm."), "info");
    return;
  }
  openComposer(tx.type, { transactionId: tx.id });
}

function openComposer(type = "expense", options = {}) {
  const transactionId = String(options?.transactionId || "").trim();
  const transaction = transactionId ? findTransactionById(transactionId) : null;

  state.composerDraft = buildTransactionDraft({
    accounts: state.accounts,
    transaction,
    type,
    presetAccountId: options?.presetAccountId || "",
  });
  renderComposerView();
  openModal("financeComposerPanel");
}

function syncComposerDraft(nextDraft = {}) {
  const activeAccounts = state.accounts.filter((item) => String(item?.status || "active") !== "archived");
  const accountId = String(nextDraft?.accountId || state.composerDraft?.accountId || "").trim();
  let toAccountId = String(nextDraft?.toAccountId || state.composerDraft?.toAccountId || "").trim();
  if (String(nextDraft?.type || "").trim() === "transfer" && (!toAccountId || toAccountId === accountId)) {
    toAccountId = String(
      activeAccounts.find((item) => String(item?.id || "").trim() !== accountId)?.id || ""
    ).trim();
  }

  state.composerDraft = {
    ...state.composerDraft,
    ...nextDraft,
    accountId,
    toAccountId,
  };
  renderComposerView();
}

function exportCurrentLedger() {
  if (!state.financeVm) return;
  const content = buildCsvContent(state.financeVm);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ledger-${state.filters.preset || "range"}-${state.filters.date || state.month}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(t("toast.csvExportSuccess", "Đã xuất CSV theo bộ lọc hiện tại."), "success");
}

async function handleResetFinanceData() {
  const uid = ensureUser();
  if (!uid) return;

  const allow = window.confirm(
    "Thao tác này sẽ xóa toàn bộ dữ liệu tài chính cũ và mới để bắt đầu lại từ đầu. Tiếp tục?"
  );
  if (!allow) return;

  setGlobalLoading(true);
  try {
    await resetFinanceData(uid);
    resetRuntimeState();
    showToast(t("toast.financeResetDone", "Đã xóa sạch dữ liệu tài chính cũ."), "success");
  } catch (err) {
    console.error("resetFinanceData error", err);
    showToast(t("toast.financeResetFail", "Không thể xóa dữ liệu tài chính."), "error");
  } finally {
    setGlobalLoading(false);
  }
}

bindKeyboardShortcuts({
  onOpenGlobalSearch: () => {
    openGlobalSearchPanel();
  },
  onOpenExpense: () => {
    if (!ensureUser()) return;
    openComposer("expense");
  },
  onOpenIncome: () => {
    if (!ensureUser()) return;
    openComposer("income");
  },
  onOpenTransfer: () => {
    if (!ensureUser()) return;
    openComposer("transfer");
  },
  onOpenLoanLend: () => {
    if (!ensureUser()) return;
    if (!state.loanParties.length) {
      showToast("Hãy thêm người mượn trước khi ghi nhận công nợ.", "info");
      return;
    }
    openLoanEntryPanel("loan_lend");
  },
  onOpenLoanRepay: () => {
    if (!ensureUser()) return;
    if (!state.loanParties.length) {
      showToast("Hãy thêm người mượn trước khi ghi nhận công nợ.", "info");
      return;
    }
    openLoanEntryPanel("loan_repay");
  },
});

bindHomeEvents({
  onChangeAccountFilter: (accountId) => {
    state.homeAccountFilter = normalizeHomeAccountFilter(accountId, state.accounts);
    rebuildHomeVm();
  },
  onLoadDailyFlow: () => {
    state.homeDailyFlowLoaded = true;
    rebuildHomeVm();
  },
  onLoadMom: async () => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await loadHomeMomData(uid);
    } catch (err) {
      console.error("load home mom error", err);
      showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = findTransactionById(transactionId);
    if (!current) return;
    openComposer(current.type, { transactionId: current.id });
  },
  onOpenSavingsGoalPanel: () => {
    if (!ensureUser()) return;
    clearSavingsForm();
    openModal("savingsGoalPanel");
  },
  onEditSavingsGoal: (goalId) => {
    if (!ensureUser()) return;
    const goal = state.savingsGoals.find((item) => String(item?.id || "").trim() === String(goalId || "").trim());
    if (!goal) return;
    renderSavingsGoalForm({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      note: goal.note,
    });
    openModal("savingsGoalPanel");
  },
  onSaveSavingsGoal: async () => {
    const uid = ensureUser();
    if (!uid) return;
    try {
      const draft = readSavingsForm();
      const payload = sanitizeSavingsGoalDraft(draft);
      const goalId = String(draft?.id || "").trim();
      if (goalId) {
        await updateSavingsGoal(uid, goalId, payload);
        showToast(t("savings.updated", "Đã cập nhật mục tiêu."), "success");
      } else {
        await createSavingsGoal(uid, payload);
        showToast(t("savings.created", "Đã thêm mục tiêu tiết kiệm."), "success");
      }
      clearSavingsForm();
      closeModal("savingsGoalPanel");
      state.savingsGoals = await listSavingsGoals(uid);
      renderSavingsGoalsSection(state.savingsGoals);
    } catch (err) {
      console.error("save savings goal error", err);
      showToast(err?.message || t("savings.saveFail", "Không thể lưu mục tiêu."), "error");
    }
  },
  onDeleteSavingsGoal: async (goalId) => {
    const uid = ensureUser();
    if (!uid) return;
    const allow = window.confirm(t("savings.confirmDelete", "Xóa mục tiêu tiết kiệm này?"));
    if (!allow) return;
    try {
      await deleteSavingsGoal(uid, goalId);
      state.savingsGoals = await listSavingsGoals(uid);
      renderSavingsGoalsSection(state.savingsGoals);
      showToast(t("savings.deleted", "Đã xóa mục tiêu."), "success");
    } catch (err) {
      console.error("delete savings goal error", err);
      showToast(err?.message || t("savings.deleteFail", "Không thể xóa mục tiêu."), "error");
    }
  },
});

bindFinanceEvents({
  onLoadFinanceMonth: async () => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await loadFinanceMonthData(uid);
    } catch (err) {
      console.error("load finance month error", err);
      showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onChangeFilters: async (patch = {}) => {
    const nextPatch = { ...patch };
    const nextDate = String(nextPatch?.date ?? state.filters?.date ?? "").trim();
    const nextMonth = getYmFromDateInput(nextDate);
    const shouldReload = Object.prototype.hasOwnProperty.call(nextPatch, "date");

    if (shouldReload && nextMonth && nextMonth !== state.month) {
      const uid = ensureUser();
      if (!uid) return;
      state.filters = {
        ...state.filters,
        ...nextPatch,
      };
      setGlobalLoading(true);
      try {
        await refreshFinance(uid, { month: nextMonth });
        if (state.filters.preset === "month") {
          await loadFinanceMonthData(uid);
        }
      } catch (err) {
        console.error("change date filter error", err);
        showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
      } finally {
        setGlobalLoading(false);
      }
      return;
    }

    state.filters = {
      ...state.filters,
      ...nextPatch,
    };

    if (shouldReload) {
      if (state.filters.preset === "month" && !state.financeMonthLoaded) {
        const uid = ensureUser();
        if (!uid) return;
        setGlobalLoading(true);
        try {
          await loadFinanceMonthData(uid);
        } catch (err) {
          console.error("load finance month error", err);
          showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
          renderFinanceView();
          syncTopbarStatsForActiveRoute();
        } finally {
          setGlobalLoading(false);
        }
        return;
      }

      applyFinanceLedgerFromCache();
      state.financeVm = buildRenderedFinanceVm();
      renderFinanceView();
      syncTopbarStatsForActiveRoute();
      return;
    }

    state.financeVm = buildRenderedFinanceVm();
    renderFinanceView();
    syncTopbarStatsForActiveRoute();
  },
  onChangePreset: async (preset) => {
    const normalizedPreset = String(preset || "today").trim() === "month" ? "month" : "today";
    state.filters = {
      ...state.filters,
      preset: normalizedPreset,
    };

    if (normalizedPreset === "month") {
      const uid = ensureUser();
      if (!uid) return;
      state.financeMonthLoaded = false;
      setGlobalLoading(true);
      try {
        await loadFinanceMonthData(uid);
      } catch (err) {
        console.error("load finance month error", err);
        showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
        renderFinanceView();
        syncTopbarStatsForActiveRoute();
      } finally {
        setGlobalLoading(false);
      }
      return;
    }

    applyFinanceLedgerFromCache();
    state.financeVm = buildRenderedFinanceVm();
    renderFinanceView();
    syncTopbarStatsForActiveRoute();
  },
  onOpenComposer: (type) => {
    if (!ensureUser()) return;
    const normalized = String(type || "expense").trim();
    if (normalized === "adjustment") return;
    openComposer(normalized);
  },
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = findTransactionById(transactionId);
    if (!current) return;
    if (String(current.type || "").trim() === "adjustment") {
      showToast(
        t(
          "toast.adjustmentRemoved",
          "Tính năng sửa số dư đã được gỡ. Bạn có thể xóa giao dịch này nếu không cần."
        ),
        "info"
      );
      return;
    }
    openComposer(current.type, { transactionId: current.id });
  },
  onDeleteTransaction: async (transactionId) => {
    const uid = ensureUser();
    if (!uid) return;
    const allow = window.confirm("Bạn chắc chắn muốn xóa giao dịch này?");
    if (!allow) return;

    setGlobalLoading(true);
    try {
      await deleteTransaction(uid, transactionId);
      await refreshWorkspaceData(uid);
      showToast(t("toast.transactionDeleted", "Đã xóa giao dịch."), "success");
    } catch (err) {
      console.error("deleteTransaction error", err);
      showToast(t("toast.transactionDeleteFail", "Không thể xóa giao dịch."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onComposerTypeChange: (draft) => {
    syncComposerDraft(draft);
  },
  onComposerDraftChange: (draft) => {
    syncComposerDraft(draft);
  },
  onSubmitTransaction: async (rawDraft) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      const payload = sanitizeTransactionDraft(rawDraft);
      if (payload.id) {
        await updateTransaction(uid, payload.id, payload);
      } else {
        await createTransaction(uid, payload);
      }
      closeModal("financeComposerPanel");
      await refreshWorkspaceData(uid);
      state.composerDraft = buildTransactionDraft({
        accounts: state.accounts,
        type: payload.type,
      });
      renderComposerView();
      showToast(t("toast.transactionSaved", "Đã lưu giao dịch."), "success");
    } catch (err) {
      console.error("save transaction error", err);
      showToast(err?.message || t("toast.transactionSaveFail", "Không thể lưu giao dịch."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onOpenAccountPanel: () => {
    if (!ensureUser()) return;
    resetFinanceAccountForm();
    openModal("financeAccountPanel");
  },
  onEditAccount: (accountId) => {
    if (!ensureUser()) return;
    const account =
      state.accounts.find((item) => String(item?.id || "").trim() === String(accountId || "").trim()) || null;
    if (!account) {
      showToast(t("toast.accountNotFound", "Không tìm thấy tài khoản."), "error");
      return;
    }
    renderFinanceAccountForm({
      draft: {
        id: account.id,
        name: account.name,
        type: account.type,
        isDefault: account.isDefault,
      },
      mode: "edit",
    });
    openModal("financeAccountPanel");
  },
  onSubmitAccount: async (rawAccount) => {
    const uid = ensureUser();
    if (!uid) return;

    const accountId = String(rawAccount?.id || "").trim();
    setGlobalLoading(true);
    try {
      if (accountId) {
        const payload = sanitizeAccountEditDraft(rawAccount);
        await updateLedgerAccount(uid, payload.id, payload);
        closeModal("financeAccountPanel");
        resetFinanceAccountForm();
        await refreshWorkspaceData(uid);
        showToast(t("toast.accountUpdated", "Đã cập nhật tài khoản."), "success");
        return;
      }

      const payload = sanitizeAccountDraft(rawAccount);
      await createAccount(uid, payload);
      closeModal("financeAccountPanel");
      resetFinanceAccountForm();
      await refreshWorkspaceData(uid);
      showToast(t("toast.accountCreated", "Đã tạo tài khoản mới."), "success");
    } catch (err) {
      console.error("saveAccount error", err);
      showToast(
        err?.message ||
          t(
            accountId ? "toast.accountUpdateFail" : "toast.accountCreateFail",
            accountId ? "Không thể cập nhật tài khoản." : "Không thể tạo tài khoản."
          ),
        "error"
      );
    } finally {
      setGlobalLoading(false);
    }
  },
  onRemoveAccount: async (accountId) => {
    const uid = ensureUser();
    if (!uid) return;
    const allow = window.confirm(
      "Nếu tài khoản đã có giao dịch, hệ thống sẽ lưu trữ thay vì xóa cứng. Tiếp tục?"
    );
    if (!allow) return;

    setGlobalLoading(true);
    try {
      await archiveAccount(uid, accountId);
      await refreshWorkspaceData(uid);
      showToast(t("toast.accountRemoved", "Đã cập nhật trạng thái tài khoản."), "success");
    } catch (err) {
      console.error("archiveAccount error", err);
      showToast(err?.message || t("toast.accountRemoveFail", "Không thể cập nhật tài khoản."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onCreateExpenseScope: async (rawScope) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await createExpenseScope(uid, rawScope);
      clearExpenseScopeInput();
      await refreshWorkspaceData(uid);
      if (state.expensesView === "manage") {
        state.scopeBudgetsMonth = "";
        await loadScopeBudgetsForMonth(uid, state.month);
        renderFinanceView();
      }
      showToast(t("toast.scopeCreated", "Đã thêm nhóm chi mới."), "success");
    } catch (err) {
      console.error("createExpenseScope error", err);
      showToast(err?.message || t("toast.scopeCreateFail", "Không thể thêm nhóm chi."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onCreateExpenseCategory: async (rawCategory) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await createExpenseCategory(uid, rawCategory);
      clearExpenseCategoryInput();
      await refreshWorkspaceData(uid);
      showToast(t("toast.categoryCreated", "Đã thêm danh mục mới."), "success");
    } catch (err) {
      console.error("createExpenseCategory error", err);
      showToast(err?.message || t("toast.categoryCreateFail", "Không thể thêm danh mục."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onCreateRecurringRule: async (raw) => {
    const uid = ensureUser();
    if (!uid) return;
    try {
      const payload = sanitizeRecurringRuleDraft(raw || readRecurringForm());
      await createRecurringRule(uid, payload);
      clearRecurringForm();
      state.recurringRules = await listRecurringRules(uid);
      renderGrowthPanels();
      showToast(t("recurring.created", "Đã thêm mẫu định kỳ."), "success");
    } catch (err) {
      console.error("create recurring rule error", err);
      showToast(err?.message || t("recurring.createFail", "Không thể thêm mẫu định kỳ."), "error");
    }
  },
  onCreateRecurringToday: async (ruleId) => {
    const uid = ensureUser();
    if (!uid) return;
    const rule = state.recurringRules.find((item) => String(item?.id || "").trim() === String(ruleId || "").trim());
    if (!rule) return;
    setGlobalLoading(true);
    try {
      const payload = buildTransactionFromRecurringRule(rule);
      await createTransaction(uid, payload);
      await refreshFinance(uid, { resetFinanceMonth: false });
      showToast(t("recurring.createdTx", "Đã tạo giao dịch từ mẫu định kỳ."), "success");
    } catch (err) {
      console.error("create recurring today error", err);
      showToast(err?.message || t("recurring.createTxFail", "Không thể tạo giao dịch định kỳ."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onDeleteRecurringRule: async (ruleId) => {
    const uid = ensureUser();
    if (!uid) return;
    const allow = window.confirm(t("recurring.confirmDelete", "Xóa mẫu định kỳ này?"));
    if (!allow) return;
    try {
      await deleteRecurringRule(uid, ruleId);
      state.recurringRules = await listRecurringRules(uid);
      renderGrowthPanels();
      showToast(t("recurring.deleted", "Đã xóa mẫu định kỳ."), "success");
    } catch (err) {
      console.error("delete recurring rule error", err);
      showToast(err?.message || t("recurring.deleteFail", "Không thể xóa mẫu định kỳ."), "error");
    }
  },
  onSaveScopeBudget: async ({ scopeId, limitAmount } = {}) => {
    const uid = ensureUser();
    if (!uid) return;

    const normalizedScopeId = String(scopeId || "").trim();
    const amount = Number(limitAmount || 0);
    if (!normalizedScopeId) {
      showToast(t("toast.scopePickRequired", "Vui lòng chọn nhóm chi."), "error");
      return;
    }

    const existing =
      state.scopeBudgets.find((item) => String(item?.scopeId || "").trim() === normalizedScopeId) || null;

    setGlobalLoading(true);
    try {
      if (!Number.isFinite(amount) || !(amount > 0)) {
        if (!existing?.id) {
          showToast(t("toast.scopeBudgetInvalid", "Nhập ngân sách lớn hơn 0."), "error");
          return;
        }
        await deleteScopeBudget(uid, existing.id);
      } else {
        await saveScopeBudget(uid, {
          scopeId: normalizedScopeId,
          monthKey: state.month,
          limitAmount: amount,
        });
      }
      state.scopeBudgetsMonth = "";
      await loadScopeBudgetsForMonth(uid, state.month);
      renderFinanceView();
      showToast(t("toast.scopeBudgetSaved", "Đã lưu ngân sách nhóm chi."), "success");
    } catch (err) {
      console.error("saveScopeBudget error", err);
      showToast(err?.message || t("toast.scopeBudgetSaveFail", "Không thể lưu ngân sách nhóm chi."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onRenameExpenseScope: async (scope) => {
    if (!ensureUser()) return;
    openExpenseScopePanel({
      mode: "rename",
      id: scope?.id,
      name: scope?.name,
    });
  },
  onDeleteExpenseScope: async (scope) => {
    const uid = ensureUser();
    if (!uid) return;

    const currentScope =
      findExpenseScopeByRef(scope?.id) ||
      state.expenseScopes.find((item) => String(item?.name || "").trim() === String(scope?.name || "").trim()) ||
      null;
    if (!currentScope) {
      showToast(t("toast.scopeNotFound", "Không tìm thấy nhóm chi cần xóa."), "error");
      return;
    }

    openExpenseScopePanel({
      mode: "delete",
      id: currentScope.id,
      name: currentScope.name,
      replacementScopeId: getReplacementScopeId(currentScope.id),
    });
  },
  onSubmitExpenseScopeForm: async (form) => {
    const uid = ensureUser();
    if (!uid) return;

    const mode = String(form?.mode || "rename").trim();
    const scopeId = String(form?.id || "").trim();
    if (!scopeId) {
      showToast("Kh\u00f4ng t\u00ecm th\u1ea5y ph\u1ea1m vi chi c\u1ea7n c\u1eadp nh\u1eadt.", "error");
      return;
    }

    setGlobalLoading(true);
    try {
      if (mode === "delete") {
        const replacementScopeId = String(form?.replacementScopeId || "").trim();
        if (!replacementScopeId || replacementScopeId === scopeId) {
          throw new Error("Vui l\u00f2ng ch\u1ecdn ph\u1ea1m vi thay th\u1ebf h\u1ee3p l\u1ec7.");
        }

        await deleteExpenseScope(uid, scopeId, {
          replacementScopeId,
        });

        closeModal("financeScopePanel");
        state.expenseScopeDraft = buildExpenseScopeDraft();
        await refreshWorkspaceData(uid);
        showToast("\u0110\u00e3 x\u00f3a ph\u1ea1m vi chi.", "success");
        return;
      }

      await updateExpenseScope(uid, scopeId, { name: form?.name });
      closeModal("financeScopePanel");
      state.expenseScopeDraft = buildExpenseScopeDraft();
      await refreshWorkspaceData(uid);
      showToast("\u0110\u00e3 c\u1eadp nh\u1eadt ph\u1ea1m vi chi.", "success");
    } catch (err) {
      console.error("submit expense scope form error", err);
      showToast(err?.message || "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt ph\u1ea1m vi chi.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onRenameExpenseCategory: async (category) => {
    if (!ensureUser()) return;
    openExpenseCategoryPanel({
      mode: "rename",
      id: category?.id,
      name: category?.name,
    });
  },
  onDeleteExpenseCategory: async (category) => {
    const uid = ensureUser();
    if (!uid) return;

    const current =
      findExpenseCategoryByRef(category?.id) ||
      findExpenseCategoryByRef(category?.key) ||
      state.expenseCategories.find(
        (item) => String(item?.name || "").trim() === String(category?.name || "").trim()
      ) ||
      null;
    if (!current) {
      showToast(t("toast.categoryNotFound", "Không tìm thấy danh mục cần xóa."), "error");
      return;
    }

    openExpenseCategoryPanel({
      mode: "delete",
      id: current.id,
      name: current.name,
      replacementCategoryId: getReplacementCategoryId(current.id),
    });
  },
  onSubmitExpenseCategoryForm: async (form) => {
    const uid = ensureUser();
    if (!uid) return;

    const mode = String(form?.mode || "rename").trim();
    const categoryId = String(form?.id || "").trim();
    if (!categoryId) {
      showToast(t("toast.categoryNotFound", "Không tìm thấy danh mục cần cập nhật."), "error");
      return;
    }

    setGlobalLoading(true);
    try {
      if (mode === "delete") {
        const replacementCategoryId = String(form?.replacementCategoryId || "").trim();
        if (!replacementCategoryId || replacementCategoryId === categoryId) {
          throw new Error("Vui lòng chọn danh mục thay thế hợp lệ.");
        }

        await deleteExpenseCategory(uid, categoryId, {
          replacementCategoryId,
        });

        closeModal("financeCategoryPanel");
        state.expenseCategoryDraft = buildExpenseCategoryDraft();
        await refreshWorkspaceData(uid);
        showToast(t("toast.categoryDeleted", "Đã xóa danh mục."), "success");
        return;
      }

      await updateExpenseCategory(uid, categoryId, { name: form?.name });
      closeModal("financeCategoryPanel");
      state.expenseCategoryDraft = buildExpenseCategoryDraft();
      await refreshWorkspaceData(uid);
      showToast(t("toast.categoryUpdated", "Đã cập nhật danh mục."), "success");
    } catch (err) {
      console.error("submit expense category form error", err);
      showToast(err?.message || t("toast.categoryUpdateFail", "Không thể cập nhật danh mục."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onExportCsv: () => {
    try {
      exportCurrentLedger();
    } catch (err) {
      console.error("export csv error", err);
      showToast(t("toast.csvExportFail", "Không thể xuất CSV."), "error");
    }
  },
  onResetFinanceData: () => {
    void handleResetFinanceData();
  },
});

bindLoanEvents({
  onLoadLoans: async () => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await refreshLoans(uid);
    } catch (err) {
      console.error("load loans error", err);
      showToast("Không thể tải dữ liệu cho mượn.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onOpenPartyCreate: () => {
    if (!ensureUser()) return;
    openLoanPartyPanel();
  },
  onEditParty: (partyId) => {
    if (!ensureUser()) return;
    const party =
      state.loanParties.find((item) => String(item?.id || "").trim() === String(partyId || "").trim()) || null;
    if (!party) return;
    openLoanPartyPanel(party);
  },
  onDeleteParty: async (partyId) => {
    const uid = ensureUser();
    if (!uid) return;
    const party =
      state.loanParties.find((item) => String(item?.id || "").trim() === String(partyId || "").trim()) || null;
    if (!party) return;

    const allow = window.confirm(`Bạn chắc chắn muốn xóa người mượn "${String(party?.name || "").trim()}"?`);
    if (!allow) return;

    setGlobalLoading(true);
    try {
      await deleteLoanParty(uid, partyId);
      await refreshWorkspaceData(uid);
      showToast("Đã xóa người mượn.", "success");
    } catch (err) {
      console.error("deleteLoanParty error", err);
      showToast(err?.message || "Không thể xóa người mượn.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onSelectParty: (partyId) => {
    state.loanSelectedPartyId = String(partyId || "").trim();
    renderLoansView();
  },
  onOpenLoanEntry: (type, options = {}) => {
    if (!ensureUser()) return;
    if (!state.loanParties.length) {
      showToast("Hãy thêm người mượn trước khi ghi nhận công nợ.", "info");
      return;
    }
    if (!state.accounts.filter((item) => String(item?.status || "active") !== "archived").length) {
      showToast("Hãy tạo ít nhất một tài khoản trước.", "info");
      return;
    }
    openLoanEntryPanel(type, options);
  },
  onEditLoanEntry: (entryId) => {
    if (!ensureUser()) return;
    const entry =
      state.loanTransactions.find((item) => String(item?.id || "").trim() === String(entryId || "").trim()) || null;
    if (!entry) return;
    openLoanEntryPanel(entry.type, { entryId: entry.id });
  },
  onDeleteLoanEntry: async (entryId) => {
    const uid = ensureUser();
    if (!uid) return;
    const allow = window.confirm("Bạn chắc chắn muốn xóa giao dịch công nợ này?");
    if (!allow) return;

    setGlobalLoading(true);
    try {
      await deleteTransaction(uid, entryId);
      await refreshWorkspaceData(uid);
      showToast("Đã xóa giao dịch công nợ.", "success");
    } catch (err) {
      console.error("delete loan entry error", err);
      showToast(err?.message || "Không thể xóa giao dịch công nợ.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onSubmitLoanParty: async (rawParty) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      const payload = sanitizeLoanPartyDraft(rawParty);
      if (payload.id) {
        await updateLoanParty(uid, payload.id, payload);
      } else {
        await createLoanParty(uid, payload);
      }
      closeModal("loanPartyPanel");
      state.loanPartyDraft = createDefaultLoanPartyDraft();
      await refreshWorkspaceData(uid);
      showToast("Đã lưu người mượn.", "success");
    } catch (err) {
      console.error("save loan party error", err);
      showToast(err?.message || "Không thể lưu người mượn.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onChangeLoanEntryDraft: (draft) => {
    syncLoanEntryDraft(draft);
  },
  onSubmitLoanEntry: async (rawDraft) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      const payload = sanitizeLoanEntryDraft(rawDraft);
      const context = buildLoanEntryContext({
        draft: payload,
        parties: state.loanParties,
        transactions: state.loanTransactions,
      });
      if (payload.type === "loan_repay" && context.isOverpay) {
        throw new Error("Số tiền nhận trả đang lớn hơn số còn nợ hiện tại.");
      }

      if (payload.id) {
        await updateTransaction(uid, payload.id, payload);
      } else {
        await createTransaction(uid, payload);
      }
      closeModal("loanEntryPanel");
      state.loanEntryDraft = createDefaultLoanEntryDraft();
      state.loanEntryContext = { visible: false };
      await refreshWorkspaceData(uid);
      showToast("Đã lưu giao dịch công nợ.", "success");
    } catch (err) {
      console.error("save loan entry error", err);
      showToast(err?.message || "Không thể lưu giao dịch công nợ.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
});

bindReportEvents({
  onDrillDown: (kind, key) => {
    void navigateReportDrillDown(kind, key);
  },
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = findTransactionById(transactionId);
    if (!current) return;
    if (String(current.type || "").trim() === "adjustment") {
      showToast(
        t(
          "toast.adjustmentRemoved",
          "Tính năng sửa số dư đã được gỡ. Bạn có thể xóa giao dịch này nếu không cần."
        ),
        "info"
      );
      return;
    }
    openComposer(current.type, { transactionId: current.id });
  },
  onExportCsv: () => {
    if (!ensureUser()) return;
    exportReportCsv();
  },
  onAiInsights: () => {
    if (!ensureUser()) return;
    void requestAiReportInsights();
  },
  onLoadReportsMom: async () => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      await loadReportsMomData(uid);
    } catch (err) {
      console.error("load reports mom error", err);
      showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onLoadReports: async () => {
    const uid = ensureUser();
    if (!uid) return;

    const nextFilters = normalizeReportFilters(state.reportFilters);
    state.reportFilters = nextFilters;
    state.reportError = validateReportFilters(nextFilters);
    renderReportsView();
    if (state.reportError) return;

    setGlobalLoading(true);
    try {
      await refreshReports(uid, nextFilters);
    } catch (err) {
      console.error("load reports error", err);
      showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onChangeDraftFilters: (draft) => {
    state.reportFilters = {
      ...state.reportFilters,
      ...draft,
    };
    state.reportError = validateReportFilters(state.reportFilters);
    renderReportsView();
  },
  onApplyFilters: async (rawFilters) => {
    const uid = ensureUser();
    if (!uid) return;

    const nextFilters = normalizeReportFilters({
      ...state.reportFilters,
      ...rawFilters,
    });
    state.reportFilters = nextFilters;
    state.reportError = validateReportFilters(nextFilters);
    renderReportsView();
    if (state.reportError) return;

    setGlobalLoading(true);
    try {
      await refreshReports(uid, nextFilters);
    } catch (err) {
      console.error("apply report filters error", err);
      showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onResetFilters: async () => {
    const uid = ensureUser();
    if (!uid) return;

    const defaults = buildDefaultReportFilters();
    state.reportFilters = defaults;
    state.reportAppliedFilters = defaults;
    state.reportError = "";
    setGlobalLoading(true);
    try {
      await refreshReports(uid, defaults);
    } catch (err) {
      console.error("reset report filters error", err);
      showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onSelectPreset: async (preset = "") => {
    const uid = ensureUser();
    if (!uid) return;

    const nextFilters = buildReportFiltersForPreset(preset);
    state.reportFilters = nextFilters;
    state.reportError = "";
    setGlobalLoading(true);
    try {
      await refreshReports(uid, nextFilters);
    } catch (err) {
      console.error("select report preset error", err);
      showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
});

ensureMonthValue(getYmFromDateInput(state.filters.date) || getCurrentYm());
syncBrandUI();
bindFilterControls();
bindAuthButtons();
resetRuntimeState();

migrateLegacyStorageKeys();

watchAuth(async (user) => {
  state.currentUser = user || null;
  updateUserMenuUI(user || null);
  updateMenuState(user || null);

  if (!user) {
    setTopbarStatsVisible(false);
    resetRuntimeState();
    setActiveRoute("auth");
    setGlobalLoading(false);
    return;
  }

  setTopbarStatsVisible(true);

  const requestedRoute = resolveWorkspaceRoute(
    state.pendingRoute && state.pendingRoute !== "auth"
      ? state.pendingRoute
      : getCurrentHashRoute() || "home"
  );

  setGlobalLoading(true);
  try {
    await refreshHome(user.uid, state.month);
    if (requestedRoute === "expenses") {
      await refreshFinance(user.uid, { month: state.month });
    }
    setActiveRoute(requestedRoute);
    if (requestedRoute === "loans") {
      renderLoansView();
    } else if (requestedRoute === "reports") {
      renderReportsView();
    }
    syncTopbarStatsForActiveRoute();
  } catch (err) {
    console.error("watchAuth refresh error", err);
    showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
  } finally {
    setGlobalLoading(false);
  }
});

window.addEventListener("htf:route-changed", async (event) => {
  const routeId = resolveWorkspaceRoute(String(event?.detail?.routeId || "").trim());
  if (routeId === "expenses") {
    state.expensesView = event?.detail?.expensesView === "manage" ? "manage" : "ledger";
    if (state.financeVm) {
      renderFinanceView();
      syncTopbarStatsForActiveRoute();
    }
    if (state.currentUser && state.expensesView === "manage") {
      try {
        await ensureManageScopeBudgets(state.currentUser.uid);
      } catch (err) {
        console.error("route manage budgets error", err);
      }
    }
  }

  if (!state.currentUser && routeId !== "auth") {
    state.pendingRoute = routeId || "home";
    setActiveRoute("auth");
    return;
  }

  if (routeId !== "auth") {
    state.pendingRoute = routeId || "home";
  }

  if (state.currentUser && routeId === "auth") {
    setActiveRoute(state.pendingRoute || "home");
    return;
  }

  if (!state.currentUser) return;

  if (routeId === "home") {
    const nextLoadKey = getHomeLoadKey(getCurrentYm());
    if (state.homeVm && state.homeLoadedKey === nextLoadKey) {
      renderHomeView();
      syncTopbarStatsForActiveRoute();
      return;
    }

    setGlobalLoading(true);
    try {
      await refreshHome(state.currentUser.uid);
    } catch (err) {
      console.error("route home refresh error", err);
      showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
    } finally {
      setGlobalLoading(false);
    }
    return;
  }

  if (routeId === "loans") {
    renderLoansView();
    syncTopbarStatsForActiveRoute();
    return;
  }

  if (routeId === "reports") {
    if (!state.reportsDataLoaded) {
      setGlobalLoading(true);
      try {
        await refreshReports(state.currentUser.uid, state.reportAppliedFilters);
      } catch (err) {
        console.error("route reports refresh error", err);
        showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
        renderReportsView();
        syncTopbarStatsForActiveRoute();
      } finally {
        setGlobalLoading(false);
      }
      return;
    }

    renderReportsView();
    syncTopbarStatsForActiveRoute();
  }
});

document.documentElement.setAttribute("data-i18n-ready", "true");

byId("globalSearch")?.addEventListener("input", (event) => {
  runGlobalSearch(event?.target?.value || "");
});

document.addEventListener("click", (event) => {
  const result = event.target.closest("[data-search-kind][data-search-id]");
  if (!result) return;
  void handleGlobalSearchSelect(result);
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("service worker register failed", err);
    });
  });
}