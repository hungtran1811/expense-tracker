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
  buildDefaultReportFilters,
  buildFinanceReportVm,
  normalizeReportFilters,
  validateReportFilters,
} from "../features/reports/reports.controller.js";
import { bindReportEvents } from "../features/reports/reports.events.js";
import { renderReportsRoute } from "../features/reports/reports.ui.js";
import {
  archiveAccount,
  createAccount,
  createExpenseScope,
  createTransaction,
  deleteExpenseScope,
  deleteScopeBudget,
  deleteTransaction,
  listAccountsWithBalances,
  listExpenseScopes,
  listScopeBudgets,
  listTransactions,
  resetFinanceData,
  saveScopeBudget,
  updateExpenseScope,
  updateTransaction,
} from "../services/firebase/firestore.js";

function createDefaultFilters() {
  return {
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

const reportDefaults = createDefaultReportState();

const state = {
  currentUser: null,
  pendingRoute: "expenses",
  month: getCurrentYm(),
  accounts: [],
  transactions: [],
  transactionsByMonth: {},
  expenseScopes: [],
  scopeBudgetsByMonth: {},
  filters: createDefaultFilters(),
  composerDraft: buildTransactionDraft(),
  composerBudgetPreview: { visible: false },
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

function promptExpenseScopeReplacement(scope = {}) {
  const currentId = String(scope?.id || "").trim();
  const availableScopes = state.expenseScopes.filter((item) => String(item?.id || "").trim() !== currentId);
  if (!availableScopes.length) {
    showToast("Cần giữ lại ít nhất 1 phạm vi chi khác để chuyển dữ liệu.", "error");
    return null;
  }

  const suggestedName = String(availableScopes[0]?.name || "").trim();
  const answer = window.prompt(
    `Phạm vi "${String(scope?.name || "").trim()}" đã có giao dịch. Nhập tên phạm vi thay thế:\n${availableScopes
      .map((item) => item.name)
      .join(", ")}`,
    suggestedName
  );

  if (answer == null) return undefined;

  const replacement = findExpenseScopeByRef(answer);
  if (!replacement || String(replacement?.id || "").trim() === currentId) {
    showToast("Không tìm thấy phạm vi thay thế hợp lệ.", "error");
    return null;
  }

  return replacement;
}

function getCurrentHashRoute() {
  return String(location.hash || "").replace("#", "").trim();
}

function getReportLoadKey(filters = state.reportAppliedFilters) {
  return JSON.stringify(normalizeReportFilters(filters));
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
  const selectEl = byId("monthFilter");
  if (selectEl && !Array.from(selectEl.options).some((option) => option.value === next)) {
    const [year, month] = next.split("-");
    if (year && month) {
      selectEl.add(new Option(`Tháng ${month}/${year}`, next));
    }
  }
  if (selectEl) selectEl.value = next;
  state.month = next;
}

function normalizeDateFilterForMonth(month = state.month) {
  const currentDate = String(state.filters?.date || "").trim();
  if (currentDate && !currentDate.startsWith(`${month}-`)) {
    state.filters.date = "";
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
    const dateFilter = String(state.financeVm?.filters?.date || "").trim();
    infoEl.textContent = dateFilter
      ? `Theo dõi giao dịch và số dư tài khoản cho ngày ${formatDateLabel(dateFilter)}.`
      : `Theo dõi toàn bộ giao dịch và số dư tài khoản cho ${state.financeVm.monthLabel}.`;
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

function resetRuntimeState() {
  const defaultReportState = createDefaultReportState();
  state.accounts = [];
  state.transactions = [];
  state.transactionsByMonth = {};
  state.expenseScopes = [];
  state.scopeBudgetsByMonth = {};
  state.filters = createDefaultFilters();
  state.composerDraft = buildTransactionDraft();
  state.composerBudgetPreview = { visible: false };
  state.expenseScopeDraft = buildExpenseScopeDraft();
  state.scopeBudgetDraft = buildScopeBudgetDraft();
  state.financeVm = null;
  state.reportFilters = defaultReportState.draft;
  state.reportAppliedFilters = defaultReportState.applied;
  state.reportTransactions = [];
  state.reportScopeBudgets = [];
  state.reportVm = null;
  state.reportError = "";
  state.reportLoadedKey = "";
  ensureMonthValue(getCurrentYm());
  clearExpenseScopeInput();
  renderApp();
}

async function refreshFinance(uid, { month = state.month } = {}) {
  ensureMonthValue(month);
  normalizeDateFilterForMonth(state.month);

  const [accounts, transactions, expenseScopes, scopeBudgets] = await Promise.all([
    listAccountsWithBalances(uid),
    listTransactions(uid, { month: state.month }),
    listExpenseScopes(uid),
    listScopeBudgets(uid, state.month),
  ]);

  state.accounts = accounts;
  state.transactions = transactions;
  state.transactionsByMonth[state.month] = transactions;
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
  link.download = `ledger-${state.month}.csv`;
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

    if (nextMonth && nextMonth !== state.month) {
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
    renderFinanceView();
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
    return;
    const uid = ensureUser();
    if (!uid) return;

    const currentName = String(scope?.name || "").trim();
    const nextName = window.prompt("Nhập tên mới cho phạm vi chi:", currentName);
    if (nextName == null) return;

    setGlobalLoading(true);
    try {
      await updateExpenseScope(uid, scope?.id, { name: nextName });
      await refreshFinance(uid);
      showToast("Đã cập nhật phạm vi chi.", "success");
    } catch (err) {
      console.error("updateExpenseScope error", err);
      showToast(err?.message || "Không thể cập nhật phạm vi chi.", "error");
    } finally {
      setGlobalLoading(false);
    }
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
    return;

    let replacementScope = null;
    if (Number(scope?.usageCount || 0) > 0) {
      const picked = promptExpenseScopeReplacement(currentScope);
      if (picked === undefined) return;
      if (!picked) return;
      replacementScope = picked;
    }

    const allow = window.confirm(
      replacementScope
        ? `Xóa phạm vi "${currentScope.name}" và chuyển dữ liệu sang "${replacementScope.name}"?`
        : `Bạn chắc chắn muốn xóa phạm vi "${currentScope.name}"?`
    );
    if (!allow) return;

    setGlobalLoading(true);
    try {
      try {
        await deleteExpenseScope(uid, currentScope.id, {
          replacementScopeId: replacementScope?.id || "",
        });
      } catch (err) {
        const message = String(err?.message || "");
        if (
          !replacementScope &&
          (message.includes("đang có giao dịch") || message.includes("đang có ngân sách"))
        ) {
          setGlobalLoading(false);
          const picked = promptExpenseScopeReplacement(currentScope);
          if (picked === undefined) return;
          if (!picked) return;
          replacementScope = picked;
          setGlobalLoading(true);
          await deleteExpenseScope(uid, currentScope.id, {
            replacementScopeId: replacementScope.id,
          });
        } else {
          throw err;
        }
      }

      invalidateFinanceMonthCache();
      invalidateReportsCache();
      await refreshFinance(uid);
      showToast("Đã xóa phạm vi chi.", "success");
    } catch (err) {
      console.error("deleteExpenseScope error", err);
      showToast(err?.message || "Không thể xóa phạm vi chi.", "error");
    } finally {
      setGlobalLoading(false);
    }
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
    return;
    const uid = ensureUser();
    if (!uid) return;

    const amount = promptScopeBudgetLimit(budget, budget, state.month);
    if (amount === undefined) return;
    if (amount == null) return;

    setGlobalLoading(true);
    try {
      await saveScopeBudget(uid, {
        scopeId: budget?.scopeId,
        monthKey: state.month,
        limitAmount: amount,
      });
      invalidateFinanceMonthCache(state.month);
      invalidateReportsCache();
      await refreshFinance(uid);
      showToast("Đã lưu ngân sách tháng.", "success");
    } catch (err) {
      console.error("saveScopeBudget error", err);
      showToast(err?.message || "Không thể lưu ngân sách tháng.", "error");
    } finally {
      setGlobalLoading(false);
    }
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

  const requestedRoute =
    state.pendingRoute && state.pendingRoute !== "auth"
      ? state.pendingRoute
      : getCurrentHashRoute() || "expenses";

  setGlobalLoading(true);
  try {
    await refreshFinance(user.uid, { month: state.month });
    if (requestedRoute === "reports") {
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
  const routeId = String(event?.detail?.routeId || "").trim();
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
