import { setActiveRoute } from "./router.js";
import { bindAuthButtons, watchAuth } from "../services/firebase/auth.js";
import {
  setGlobalLoading,
  showToast,
  updateNavbarStats,
  updateUserMenuUI,
} from "../shared/ui/core.js";
import { bindFilterControls, syncFilterControls } from "../shared/ui/filterControls.js";
import { t } from "../shared/constants/copy.vi.js";
import {
  buildCsvContent,
  buildFinanceVm,
  buildScopeBudgetPreview,
  buildTransactionDraft,
  formatCurrency,
  formatDateLabel,
  formatMonthLabel,
  getFinanceRange,
  getCurrentYm,
  getTodayInputValue,
  getYmFromDateInput,
  sanitizeAccountDraft,
  sanitizeTransactionDraft,
} from "../features/finance/finance.controller.js";
import { bindFinanceEvents } from "../features/finance/finance.events.js";
import {
  renderExpenseScopeForm,
  renderFinanceComposer,
  renderFinanceBudgetForm,
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
  normalizeReportFilters,
  validateReportFilters,
} from "../features/reports/reports.controller.js";
import { bindReportEvents } from "../features/reports/reports.events.js";
import { renderReportsRoute } from "../features/reports/reports.ui.js";
import {
  buildDefaultOverviewFilters,
  buildOverviewVm,
  getOverviewBudgetMonthKey,
  getOverviewRange,
  getPreviousOverviewRange,
  normalizeOverviewFilters,
  validateOverviewFilters,
} from "../features/overview/overview.controller.js";
import { bindOverviewEvents } from "../features/overview/overview.events.js";
import { renderOverviewRoute } from "../features/overview/overview.ui.js";
import {
  archiveAccount,
  createAccount,
  createExpenseScope,
  createLoanParty,
  createTransaction,
  deleteExpenseScope,
  deleteLoanParty,
  deleteScopeBudget,
  deleteTransaction,
  listAccountsWithBalances,
  listExpenseScopes,
  listLoanParties,
  listScopeBudgets,
  listTransactions,
  resetFinanceData,
  saveScopeBudget,
  updateExpenseScope,
  updateLoanParty,
  updateTransaction,
} from "../services/firebase/firestore.js";

function createDefaultFilters() {
  return {
    preset: "30d",
    accountId: "all",
    type: "all",
    categoryKey: "all",
    scopeId: "all",
    date: getTodayInputValue(),
    search: "",
  };
}

function createDefaultOverviewState() {
  const filters = buildDefaultOverviewFilters();
  return {
    draft: { ...filters },
    applied: { ...filters },
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

const overviewDefaults = createDefaultOverviewState();
const reportDefaults = createDefaultReportState();

const state = {
  currentUser: null,
  pendingRoute: "expenses",
  month: getCurrentYm(),
  accounts: [],
  transactions: [],
  transactionsByMonth: {},
  expenseScopes: [],
  loanParties: [],
  loanTransactions: [],
  loansLoaded: false,
  loanSelectedPartyId: "",
  scopeBudgetsByMonth: {},
  filters: createDefaultFilters(),
  overviewFilters: overviewDefaults.draft,
  overviewAppliedFilters: overviewDefaults.applied,
  overviewTransactions: [],
  overviewPreviousTransactions: [],
  overviewBudgetTransactions: [],
  overviewScopeBudgets: [],
  overviewVm: null,
  overviewError: "",
  overviewLoadedKey: "",
  composerDraft: buildTransactionDraft(),
  composerBudgetPreview: { visible: false },
  loanPartyDraft: createDefaultLoanPartyDraft(),
  loanEntryDraft: createDefaultLoanEntryDraft(),
  loanEntryContext: { visible: false },
  expenseScopeDraft: {
    mode: "rename",
    id: "",
    name: "",
    replacementScopeId: "",
  },
  scopeBudgetDraft: {
    id: "",
    scopeId: "",
    limitAmount: "",
    monthKey: getCurrentYm(),
    monthLabel: formatMonthLabel(getCurrentYm()),
  },
  financeVm: null,
  loansVm: null,
  reportFilters: reportDefaults.draft,
  reportAppliedFilters: reportDefaults.applied,
  reportTransactions: [],
  reportScopeBudgets: [],
  reportVm: null,
  reportError: "",
  reportLoadedKey: "",
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

function openBudgetPanel(draft = {}) {
  state.scopeBudgetDraft = buildScopeBudgetDraft(draft);
  renderFinanceBudgetForm({
    draft: state.scopeBudgetDraft,
    expenseScopes: state.expenseScopes,
  });
  openModal("financeBudgetPanel");
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

function buildScopeBudgetDraft(payload = {}) {
  const monthKey = String(payload?.monthKey || state.month || getCurrentYm()).trim() || getCurrentYm();
  return {
    id: String(payload?.id || "").trim(),
    scopeId: String(payload?.scopeId || "").trim(),
    limitAmount:
      payload?.limitAmount === "" || payload?.limitAmount == null ? "" : Number(payload?.limitAmount || 0),
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
  };
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
  if (raw === "overview") return "reports";
  return raw || "expenses";
}

function getOverviewLoadKey(filters = state.overviewAppliedFilters) {
  return JSON.stringify(normalizeOverviewFilters(filters));
}

function getReportLoadKey(filters = state.reportAppliedFilters) {
  return JSON.stringify(normalizeReportFilters(filters));
}

function invalidateOverviewCache() {
  state.overviewLoadedKey = "";
}

function invalidateReportsCache() {
  state.reportLoadedKey = "";
}

function invalidateFinanceMonthCache(monthKey = "") {
  const normalizedMonth = String(monthKey || "").trim();
  if (!normalizedMonth) {
    state.transactionsByMonth = {};
    state.scopeBudgetsByMonth = {};
    return;
  }

  delete state.transactionsByMonth[normalizedMonth];
  delete state.scopeBudgetsByMonth[normalizedMonth];
}

function getScopeBudgetsForMonth(monthKey = state.month) {
  return state.scopeBudgetsByMonth[String(monthKey || "").trim()] || [];
}

function getTransactionsForMonth(monthKey = state.month) {
  return state.transactionsByMonth[String(monthKey || "").trim()] || [];
}

function getReportBudgetMonthKey(filters = state.reportAppliedFilters) {
  const fromDate = String(filters?.fromDate || "").trim();
  const toDate = String(filters?.toDate || "").trim();
  const fromMonth = getYmFromDateInput(fromDate);
  const toMonth = getYmFromDateInput(toDate);
  if (!fromMonth || !toMonth) return "";
  return fromMonth === toMonth ? fromMonth : "";
}

async function ensureFinanceMonthResources(uid, monthKey = state.month) {
  const normalizedMonth = String(monthKey || "").trim() || getCurrentYm();
  const tasks = [];

  if (!state.transactionsByMonth[normalizedMonth]) {
    tasks.push(
      listTransactions(uid, { month: normalizedMonth }).then((items) => {
        state.transactionsByMonth[normalizedMonth] = items;
        return items;
      })
    );
  }

  if (!state.scopeBudgetsByMonth[normalizedMonth]) {
    tasks.push(
      listScopeBudgets(uid, normalizedMonth).then((items) => {
        state.scopeBudgetsByMonth[normalizedMonth] = items;
        return items;
      })
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }

  return {
    transactions: getTransactionsForMonth(normalizedMonth),
    scopeBudgets: getScopeBudgetsForMonth(normalizedMonth),
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

function buildRenderedFinanceVm() {
  const vm = buildFinanceVm({
    month: state.month,
    accounts: state.accounts,
    transactions: state.transactions,
    budgetTransactions: getTransactionsForMonth(state.month),
    expenseScopes: state.expenseScopes,
    scopeBudgets: getScopeBudgetsForMonth(state.month),
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

function renderOverviewView() {
  const vm =
    state.overviewVm ||
    buildOverviewVm({
      filters: state.overviewAppliedFilters,
      accounts: state.accounts,
      currentTransactions: state.overviewTransactions,
      previousTransactions: state.overviewPreviousTransactions,
      expenseScopes: state.expenseScopes,
      scopeBudgets: state.overviewScopeBudgets,
      budgetTransactions: state.overviewBudgetTransactions,
    });

  renderOverviewRoute(vm, {
    draftFilters: state.overviewFilters,
    error: state.overviewError,
  });
  syncFilterControls();
}

function renderFinanceView() {
  state.financeVm = buildRenderedFinanceVm();
  renderFinanceRoute(state.financeVm);
  syncFilterControls();
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    budgetPreview: state.composerBudgetPreview,
  });

  updateNavbarStats(state.financeVm.summary.expenseTotal, state.financeVm.summary.incomeTotal);

  const infoEl = byId("financeWorkspaceInfo");
  if (infoEl) {
    const rangeLabel = String(state.financeVm?.range?.presetLabel || "").trim().toLowerCase();
    const anchorDate = String(state.financeVm?.filters?.date || "").trim();
    infoEl.textContent = `Theo dõi ${rangeLabel} kết thúc vào ${formatDateLabel(anchorDate)}.`;
  }

  renderFinanceBudgetForm({
    draft: state.scopeBudgetDraft,
    expenseScopes: state.expenseScopes,
  });
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
  state.loansVm = buildRenderedLoansVm();
  state.loanSelectedPartyId = state.loansVm?.selectedPartyId || "";
  renderLoansRoute(state.loansVm);
  renderLoanPartyForm({
    draft: state.loanPartyDraft,
  });
  renderLoanEntryView();
}

function renderReportsView() {
  const vm =
    state.reportVm ||
    buildFinanceReportVm({
      filters: state.reportAppliedFilters,
      accounts: state.accounts,
      transactions: state.reportTransactions,
      expenseScopes: state.expenseScopes,
      scopeBudgets: state.reportScopeBudgets,
      budgetMonthKey: getReportBudgetMonthKey(state.reportAppliedFilters),
    });

  renderReportsRoute(vm, {
    draftFilters: state.reportFilters,
    error: state.reportError,
  });
  syncFilterControls();
}

function renderApp() {
  renderFinanceView();
  renderLoansView();
  renderReportsView();
}

function renderComposerView() {
  renderFinanceComposer({
    draft: state.composerDraft,
    accounts: state.accounts,
    expenseScopes: state.expenseScopes,
    budgetPreview: state.composerBudgetPreview,
  });
}

async function updateComposerBudgetPreview() {
  const uid = String(state.currentUser?.uid || "").trim();
  const draft = state.composerDraft || {};
  const monthKey = getYmFromDateInput(draft?.occurredAt) || state.month || getCurrentYm();

  if (!uid || String(draft?.type || "").trim() !== "expense" || !String(draft?.scopeId || "").trim()) {
    state.composerBudgetPreview = { visible: false };
    renderComposerView();
    return;
  }

  try {
    await ensureFinanceMonthResources(uid, monthKey);
    state.composerBudgetPreview = buildScopeBudgetPreview({
      draft,
      transactions: getTransactionsForMonth(monthKey),
      scopeBudgets: getScopeBudgetsForMonth(monthKey),
      expenseScopes: state.expenseScopes,
    });
  } catch (err) {
    console.error("updateComposerBudgetPreview error", err);
    state.composerBudgetPreview = { visible: false };
  }

  renderComposerView();
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
  const defaultOverviewState = createDefaultOverviewState();
  const defaultReportState = createDefaultReportState();
  state.accounts = [];
  state.transactions = [];
  state.transactionsByMonth = {};
  state.expenseScopes = [];
  state.loanParties = [];
  state.loanTransactions = [];
  state.loansLoaded = false;
  state.loanSelectedPartyId = "";
  state.scopeBudgetsByMonth = {};
  state.filters = createDefaultFilters();
  state.overviewFilters = defaultOverviewState.draft;
  state.overviewAppliedFilters = defaultOverviewState.applied;
  state.overviewTransactions = [];
  state.overviewPreviousTransactions = [];
  state.overviewBudgetTransactions = [];
  state.overviewScopeBudgets = [];
  state.overviewVm = null;
  state.overviewError = "";
  state.overviewLoadedKey = "";
  state.composerDraft = buildTransactionDraft();
  state.composerBudgetPreview = { visible: false };
  state.loanPartyDraft = createDefaultLoanPartyDraft();
  state.loanEntryDraft = createDefaultLoanEntryDraft();
  state.loanEntryContext = { visible: false };
  state.expenseScopeDraft = buildExpenseScopeDraft();
  state.scopeBudgetDraft = buildScopeBudgetDraft();
  state.financeVm = null;
  state.loansVm = null;
  state.reportFilters = defaultReportState.draft;
  state.reportAppliedFilters = defaultReportState.applied;
  state.reportTransactions = [];
  state.reportScopeBudgets = [];
  state.reportVm = null;
  state.reportError = "";
  state.reportLoadedKey = "";
  ensureMonthValue(getYmFromDateInput(state.filters.date) || getCurrentYm());
  clearExpenseScopeInput();
  renderApp();
}

async function refreshFinance(uid, { month = state.month } = {}) {
  state.filters = {
    ...createDefaultFilters(),
    ...state.filters,
  };
  const range = getFinanceRange(state.filters);
  const budgetMonth = getYmFromDateInput(state.filters.date) || month || getCurrentYm();
  ensureMonthValue(budgetMonth);
  normalizeDateFilterForMonth(state.month);

  const [accounts, transactions, budgetTransactions, expenseScopes, scopeBudgets] = await Promise.all([
    listAccountsWithBalances(uid),
    listTransactions(uid, {
      fromDate: range.fromDate,
      toDate: range.toDate,
    }),
    listTransactions(uid, { month: state.month }),
    listExpenseScopes(uid),
    listScopeBudgets(uid, state.month),
  ]);

  state.accounts = accounts;
  state.transactions = transactions;
  state.transactionsByMonth[state.month] = budgetTransactions;
  state.expenseScopes = expenseScopes;
  state.scopeBudgetsByMonth[state.month] = scopeBudgets;

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

  if (state.reportVm) {
    state.reportVm = buildFinanceReportVm({
      filters: state.reportAppliedFilters,
      accounts: state.accounts,
      transactions: state.reportTransactions,
      expenseScopes: state.expenseScopes,
      scopeBudgets: state.reportScopeBudgets,
      budgetMonthKey: getReportBudgetMonthKey(state.reportAppliedFilters),
    });
  }

  await updateComposerBudgetPreview();
  renderApp();
}

async function refreshLoans(uid) {
  const [accounts, parties, transactions] = await Promise.all([
    listAccountsWithBalances(uid),
    listLoanParties(uid),
    listTransactions(uid),
  ]);

  state.accounts = accounts;
  state.loanParties = parties;
  state.loanTransactions = transactions;
  state.loansLoaded = true;
  state.loansVm = buildRenderedLoansVm();
  state.loanSelectedPartyId = state.loansVm?.selectedPartyId || "";
  state.loanEntryContext = buildLoanEntryContext({
    draft: state.loanEntryDraft,
    parties: state.loanParties,
    transactions: state.loanTransactions,
  });
  renderApp();
}

async function refreshReports(uid, filters = state.reportAppliedFilters) {
  const normalized = normalizeReportFilters(filters);
  const budgetMonthKey = getReportBudgetMonthKey(normalized);
  const [accounts, transactions, scopeBudgets] = await Promise.all([
    listAccountsWithBalances(uid),
    listTransactions(uid, {
      fromDate: normalized.fromDate,
      toDate: normalized.toDate,
    }),
    budgetMonthKey ? listScopeBudgets(uid, budgetMonthKey) : Promise.resolve([]),
  ]);

  state.accounts = accounts;
  state.reportAppliedFilters = normalized;
  state.reportTransactions = transactions;
  state.reportScopeBudgets = scopeBudgets;
  state.reportVm = buildFinanceReportVm({
    filters: normalized,
    accounts,
    transactions,
    expenseScopes: state.expenseScopes,
    scopeBudgets,
    budgetMonthKey,
  });
  state.reportLoadedKey = getReportLoadKey(normalized);
  renderApp();
}

async function refreshOverview(uid, filters = state.overviewAppliedFilters) {
  const normalized = normalizeOverviewFilters(filters);
  const currentRange = getOverviewRange(normalized);
  const previousRange = getPreviousOverviewRange(normalized);
  const budgetMonthKey = getOverviewBudgetMonthKey(normalized);

  const [accounts, expenseScopes, currentTransactions, previousTransactions, budgetTransactions, scopeBudgets] =
    await Promise.all([
      listAccountsWithBalances(uid),
      listExpenseScopes(uid),
      listTransactions(uid, {
        fromDate: currentRange.fromDate,
        toDate: currentRange.toDate,
      }),
      listTransactions(uid, {
        fromDate: previousRange.fromDate,
        toDate: previousRange.toDate,
      }),
      listTransactions(uid, { month: budgetMonthKey }),
      listScopeBudgets(uid, budgetMonthKey),
    ]);

  state.accounts = accounts;
  state.expenseScopes = expenseScopes;
  state.overviewAppliedFilters = normalized;
  state.overviewTransactions = currentTransactions;
  state.overviewPreviousTransactions = previousTransactions;
  state.overviewBudgetTransactions = budgetTransactions;
  state.overviewScopeBudgets = scopeBudgets;
  state.overviewVm = buildOverviewVm({
    filters: normalized,
    accounts,
    currentTransactions,
    previousTransactions,
    expenseScopes,
    scopeBudgets,
    budgetTransactions,
  });
  state.overviewLoadedKey = getOverviewLoadKey(normalized);
  renderApp();
}

function openComposer(type = "expense", options = {}) {
  const transactionId = String(options?.transactionId || "").trim();
  const transaction = transactionId
    ? state.transactions.find((item) => String(item?.id || "").trim() === transactionId) || null
    : null;

  state.composerDraft = buildTransactionDraft({
    accounts: state.accounts,
    transaction,
    type,
    presetAccountId: options?.presetAccountId || "",
  });
  state.composerBudgetPreview = { visible: false };
  renderComposerView();
  void updateComposerBudgetPreview();
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
  void updateComposerBudgetPreview();
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

bindFinanceEvents({
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
      const uid = ensureUser();
      if (!uid) return;
      setGlobalLoading(true);
      try {
        await refreshFinance(uid, { month: nextMonth || state.month });
      } catch (err) {
        console.error("change finance filter error", err);
        showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
      } finally {
        setGlobalLoading(false);
      }
      return;
    }

    renderFinanceView();
  },
  onChangePreset: async (preset) => {
    const uid = ensureUser();
    if (!uid) return;
    state.filters = {
      ...state.filters,
      preset,
    };
    setGlobalLoading(true);
    try {
      await refreshFinance(uid, { month: getYmFromDateInput(state.filters.date) || state.month });
    } catch (err) {
      console.error("change finance preset error", err);
      showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onOpenComposer: (type) => {
    if (!ensureUser()) return;
    openComposer(type);
  },
  onEditTransaction: (transactionId) => {
    if (!ensureUser()) return;
    const current = state.transactions.find(
      (item) => String(item?.id || "").trim() === String(transactionId || "").trim()
    );
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
      invalidateFinanceMonthCache();
      invalidateReportsCache();
      await refreshFinance(uid);
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
      invalidateFinanceMonthCache();
      invalidateReportsCache();
      closeModal("financeComposerPanel");
      await refreshFinance(uid);
      state.composerDraft = buildTransactionDraft({
        accounts: state.accounts,
        type: payload.type,
      });
      state.composerBudgetPreview = { visible: false };
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
  onSubmitAccount: async (rawAccount) => {
    const uid = ensureUser();
    if (!uid) return;

    setGlobalLoading(true);
    try {
      const payload = sanitizeAccountDraft(rawAccount);
      await createAccount(uid, payload);
      invalidateReportsCache();
      closeModal("financeAccountPanel");
      resetFinanceAccountForm();
      await refreshFinance(uid);
      showToast(t("toast.accountCreated", "Đã tạo tài khoản mới."), "success");
    } catch (err) {
      console.error("createAccount error", err);
      showToast(err?.message || t("toast.accountCreateFail", "Không thể tạo tài khoản."), "error");
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
      invalidateReportsCache();
      await refreshFinance(uid);
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
      await refreshFinance(uid);
      showToast("Đã thêm phạm vi chi mới.", "success");
    } catch (err) {
      console.error("createExpenseScope error", err);
      showToast(err?.message || "Không thể thêm phạm vi chi.", "error");
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
      showToast("Không tìm thấy phạm vi chi cần xóa.", "error");
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

        invalidateFinanceMonthCache();
        invalidateReportsCache();
        closeModal("financeScopePanel");
        state.expenseScopeDraft = buildExpenseScopeDraft();
        await refreshFinance(uid);
        showToast("\u0110\u00e3 x\u00f3a ph\u1ea1m vi chi.", "success");
        return;
      }

      await updateExpenseScope(uid, scopeId, { name: form?.name });
      closeModal("financeScopePanel");
      state.expenseScopeDraft = buildExpenseScopeDraft();
      await refreshFinance(uid);
      showToast("\u0110\u00e3 c\u1eadp nh\u1eadt ph\u1ea1m vi chi.", "success");
    } catch (err) {
      console.error("submit expense scope form error", err);
      showToast(err?.message || "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt ph\u1ea1m vi chi.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onSaveScopeBudget: async (budget) => {
    if (!ensureUser()) return;
    openBudgetPanel({
      id: budget?.id,
      scopeId: budget?.scopeId,
      limitAmount: budget?.limitAmount,
      monthKey: state.month,
    });
  },
  onSubmitScopeBudget: async (rawBudget) => {
    const uid = ensureUser();
    if (!uid) return;

    const scopeId = String(rawBudget?.scopeId || "").trim();
    const limitAmount = Number(rawBudget?.limitAmount || 0);
    if (!scopeId) {
      showToast("Vui lòng chọn phạm vi chi.", "error");
      return;
    }
    if (!Number.isFinite(limitAmount) || !(limitAmount > 0)) {
      showToast("Ngân sách phải lớn hơn 0.", "error");
      return;
    }

    setGlobalLoading(true);
    try {
      await saveScopeBudget(uid, {
        scopeId,
        monthKey: state.scopeBudgetDraft?.monthKey || state.month,
        limitAmount,
      });
      invalidateFinanceMonthCache(state.scopeBudgetDraft?.monthKey || state.month);
      invalidateReportsCache();
      closeModal("financeBudgetPanel");
      state.scopeBudgetDraft = buildScopeBudgetDraft();
      await refreshFinance(uid);
      showToast("Đã lưu ngân sách tháng.", "success");
    } catch (err) {
      console.error("saveScopeBudget error", err);
      showToast(err?.message || "Không thể lưu ngân sách tháng.", "error");
    } finally {
      setGlobalLoading(false);
    }
  },
  onDeleteScopeBudget: async (budget) => {
    const uid = ensureUser();
    if (!uid) return;

    const allow = window.confirm(
      `Bạn chắc chắn muốn xóa mức ngân sách tháng ${formatMonthLabel(state.month)} cho phạm vi "${String(
        budget?.scopeName || ""
      ).trim()}"?`
    );
    if (!allow) return;

    setGlobalLoading(true);
    try {
      await deleteScopeBudget(uid, budget?.id);
      invalidateFinanceMonthCache(state.month);
      invalidateReportsCache();
      await refreshFinance(uid);
      showToast("Đã xóa ngân sách tháng.", "success");
    } catch (err) {
      console.error("deleteScopeBudget error", err);
      showToast(err?.message || "Không thể xóa ngân sách tháng.", "error");
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
      await refreshLoans(uid);
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
      invalidateFinanceMonthCache();
      invalidateReportsCache();
      await refreshFinance(uid);
      await refreshLoans(uid);
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
      await refreshLoans(uid);
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
      invalidateFinanceMonthCache();
      invalidateReportsCache();
      closeModal("loanEntryPanel");
      state.loanEntryDraft = createDefaultLoanEntryDraft();
      state.loanEntryContext = { visible: false };
      await refreshFinance(uid);
      await refreshLoans(uid);
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
});

bindOverviewEvents({
  onChangePreset: (preset) => {
    state.overviewFilters = normalizeOverviewFilters({
      ...state.overviewFilters,
      preset,
    });
    state.overviewError = validateOverviewFilters(state.overviewFilters);
    renderOverviewView();
  },
  onChangeDraftFilters: (draft) => {
    state.overviewFilters = normalizeOverviewFilters({
      ...state.overviewFilters,
      ...draft,
    });
    state.overviewError = validateOverviewFilters(state.overviewFilters);
    renderOverviewView();
  },
  onApplyFilters: async (rawFilters) => {
    const uid = ensureUser();
    if (!uid) return;

    const nextFilters = normalizeOverviewFilters({
      ...state.overviewFilters,
      ...rawFilters,
    });
    state.overviewFilters = nextFilters;
    state.overviewError = validateOverviewFilters(nextFilters);
    renderOverviewView();
    if (state.overviewError) return;

    setGlobalLoading(true);
    try {
      await refreshOverview(uid, nextFilters);
    } catch (err) {
      console.error("apply overview filters error", err);
      showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
    } finally {
      setGlobalLoading(false);
    }
  },
});

ensureMonthValue(getYmFromDateInput(state.filters.date) || getCurrentYm());
bindFilterControls();
bindAuthButtons();
resetRuntimeState();

watchAuth(async (user) => {
  state.currentUser = user || null;
  updateUserMenuUI(user || null);
  updateMenuState(user || null);

  if (!user) {
    resetRuntimeState();
    setActiveRoute("auth");
    setGlobalLoading(false);
    return;
  }

  const requestedRoute = resolveWorkspaceRoute(
    state.pendingRoute && state.pendingRoute !== "auth"
      ? state.pendingRoute
      : getCurrentHashRoute() || "expenses"
  );

  setGlobalLoading(true);
  try {
    await refreshFinance(user.uid, { month: state.month });
    if (requestedRoute === "loans") {
      await refreshLoans(user.uid);
    } else if (requestedRoute === "reports") {
      await refreshReports(user.uid, state.reportAppliedFilters);
    }
    setActiveRoute(requestedRoute);
  } catch (err) {
    console.error("watchAuth refresh error", err);
    showToast(t("toast.loadFail", "Không thể tải dữ liệu tài chính. Vui lòng thử lại."), "error");
  } finally {
    setGlobalLoading(false);
  }
});

window.addEventListener("nexus:route-changed", async (event) => {
  const routeId = resolveWorkspaceRoute(String(event?.detail?.routeId || "").trim());
  if (!state.currentUser && routeId !== "auth") {
    state.pendingRoute = routeId || "expenses";
    setActiveRoute("auth");
    return;
  }

  if (routeId !== "auth") {
    state.pendingRoute = routeId || "expenses";
  }

  if (state.currentUser && routeId === "auth") {
    setActiveRoute(state.pendingRoute || "expenses");
    return;
  }

  if (!state.currentUser) return;
  if (routeId === "loans") {
    if (state.loansLoaded) {
      renderLoansView();
      return;
    }

    setGlobalLoading(true);
    try {
      await refreshLoans(state.currentUser.uid);
    } catch (err) {
      console.error("route loans refresh error", err);
      showToast("Không thể tải dữ liệu cho mượn.", "error");
    } finally {
      setGlobalLoading(false);
    }
    return;
  }

  if (routeId !== "reports") return;

  const nextLoadKey = getReportLoadKey(state.reportAppliedFilters);
  if (state.reportVm && state.reportLoadedKey === nextLoadKey) {
    renderReportsView();
    return;
  }

  setGlobalLoading(true);
  try {
    await refreshReports(state.currentUser.uid, state.reportAppliedFilters);
  } catch (err) {
    console.error("route reports refresh error", err);
    showToast(t("toast.reportLoadFail", "Không thể tải báo cáo tài chính."), "error");
  } finally {
    setGlobalLoading(false);
  }
});

document.documentElement.setAttribute("data-i18n-ready", "true");
