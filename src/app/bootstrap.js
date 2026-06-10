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
import { t } from "../shared/constants/copy.vi.js";
import {
  buildCsvContent,
  buildFinanceVm,
  buildTransactionDraft,
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getFinanceRange,
  getCurrentYm,
  getTodayInputValue,
  getYmFromDateInput,
  toDateInputValue,
  sanitizeAccountDraft,
  sanitizeAccountEditDraft,
  sanitizeTransactionDraft,
} from "../features/finance/finance.controller.js";
import { bindFinanceEvents } from "../features/finance/finance.events.js";
import {
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
  buildReportFiltersForPreset,
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
  createExpenseScope,
  createLoanParty,
  createTransaction,
  deleteExpenseScope,
  deleteLoanParty,
  deleteTransaction,
  listAccountsWithBalances,
  listExpenseScopes,
  listLoanParties,
  listLoanTransactions,
  listTransactions,
  resetFinanceData,
  updateExpenseScope,
  updateLedgerAccount,
  updateLoanParty,
  updateTransaction,
} from "../services/firebase/firestore.js";

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
  loanParties: [],
  loanTransactions: [],
  loansLoaded: false,
  reportsDataLoaded: false,
  homeDailyFlowLoaded: false,
  financeMonthLoaded: false,
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
  renderFinanceRoute(state.financeVm, state.expensesView, {
    financeMonthLoaded: state.financeMonthLoaded,
  });
  syncFilterControls();
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
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
            "Chọn Tháng này rồi bấm Tải giao dịch tháng để xem toàn bộ giao dịch trong tháng."
          )
        : range?.preset === "month"
          ? `Theo dõi giao dịch trong ${rangeLabel.toLowerCase()}.`
          : `Theo dõi ${rangeLabel.toLowerCase()} kết thúc vào ${formatDateLabel(anchorDate)}.`;
  }
  renderExpenseScopeForm({
    draft: state.expenseScopeDraft,
    expenseScopes: state.expenseScopes,
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

function renderHomeView() {
  if (!state.homeVm) return;
  renderHomeRoute(state.homeVm);
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
    includeDailyFlow: state.homeDailyFlowLoaded,
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

  renderReportsRoute(vm, {
    draftFilters: state.reportFilters,
    error: state.reportError,
    activePreset: resolveReportPreset(state.reportAppliedFilters),
    reportsDataLoaded: state.reportsDataLoaded,
  });
  syncFilterControls();
}

function renderApp() {
  renderHomeView();
  renderFinanceView();
  renderLoansView();
  renderReportsView();
  syncTopbarStatsForActiveRoute();
}

function renderComposerView() {
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
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
  state.loanParties = [];
  state.loanTransactions = [];
  state.loansLoaded = false;
  state.reportsDataLoaded = false;
  state.homeDailyFlowLoaded = false;
  state.financeMonthLoaded = false;
  state.loanSelectedPartyId = "";
  state.filters = createDefaultFilters();
  state.composerDraft = buildTransactionDraft();
  state.expensesView = "ledger";
  state.loanPartyDraft = createDefaultLoanPartyDraft();
  state.loanEntryDraft = createDefaultLoanEntryDraft();
  state.loanEntryContext = { visible: false };
  state.expenseScopeDraft = buildExpenseScopeDraft();
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
    includeDailyFlow: state.homeDailyFlowLoaded,
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

function filterTransactionsByDateRange(transactions = [], fromDate = "", toDate = "") {
  const from = String(fromDate || "").trim();
  const to = String(toDate || "").trim();

  return (Array.isArray(transactions) ? transactions : []).filter((transaction) => {
    const dateKey = toDateInputValue(transaction?.occurredAt);
    if (!dateKey) return false;
    if (from && dateKey < from) return false;
    if (to && dateKey > to) return false;
    return true;
  });
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
  rebuildHomeVm();
  renderFinanceView();
  syncTopbarStatsForActiveRoute();
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

  const [accounts, expenseScopes, loanParties, coreTransactions] = await Promise.all([
    listAccountsWithBalances(uid),
    listExpenseScopes(uid),
    listLoanParties(uid),
    loadCoreWorkspaceTransactions(uid, { normalizedMonth }),
  ]);

  const { monthTransactions } = coreTransactions;

  state.accounts = accounts;
  state.expenseScopes = expenseScopes;
  state.monthTransactions = monthTransactions;
  state.transactionsByMonth[normalizedMonth] = monthTransactions;
  state.loanParties = loanParties;

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
}

async function refreshWorkspaceData(uid) {
  await refreshWorkspaceCore(uid);
}

async function refreshFinance(uid, { month = state.month, resetFinanceMonth = true } = {}) {
  const budgetMonth = getYmFromDateInput(state.filters.date) || month || getCurrentYm();
  ensureMonthValue(budgetMonth);
  if (resetFinanceMonth) {
    state.financeMonthLoaded = false;
  }
  await refreshWorkspaceData(uid);
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
  state.reportTransactions = await fetchReportTransactions(uid, state.reportAppliedFilters);
  state.reportsDataLoaded = true;
  rebuildReportsVm();
  renderReportsView();
  syncTopbarStatsForActiveRoute();
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
  return null;
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
  onFocusSearch: () => {
    const searchEl = byId("ledgerFilterSearch");
    if (!searchEl) return;
    const drawer = byId("ledgerFilterDrawer");
    if (drawer && !drawer.open) drawer.open = true;
    searchEl.focus();
    searchEl.select?.();
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
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = findTransactionById(transactionId);
    if (!current) return;
    openComposer(current.type, { transactionId: current.id });
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
        renderFinanceView();
        syncTopbarStatsForActiveRoute();
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
      state.financeMonthLoaded = false;
      renderFinanceView();
      syncTopbarStatsForActiveRoute();
      return;
    }

    applyFinanceLedgerFromCache();
    state.financeVm = buildRenderedFinanceVm();
    renderFinanceView();
    syncTopbarStatsForActiveRoute();
  },
  onOpenComposer: (type) => {
    if (!ensureUser()) return;
    openComposer(type);
  },
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = findTransactionById(transactionId);
    if (!current) return;
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
  onOpenAdjustment: (accountId) => {
    if (!ensureUser()) return;
    openComposer("adjustment", { presetAccountId: accountId });
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
      showToast(t("toast.scopeCreated", "Đã thêm nhóm chi mới."), "success");
    } catch (err) {
      console.error("createExpenseScope error", err);
      showToast(err?.message || t("toast.scopeCreateFail", "Không thể thêm nhóm chi."), "error");
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

window.addEventListener("nexus:route-changed", async (event) => {
  const routeId = resolveWorkspaceRoute(String(event?.detail?.routeId || "").trim());
  if (routeId === "expenses") {
    state.expensesView = event?.detail?.expensesView === "manage" ? "manage" : "ledger";
    if (state.financeVm) {
      renderFinanceView();
      syncTopbarStatsForActiveRoute();
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
    renderReportsView();
    syncTopbarStatsForActiveRoute();
  }
});

document.documentElement.setAttribute("data-i18n-ready", "true");
