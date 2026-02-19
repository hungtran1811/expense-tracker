import {
  populateExpenseFiltersOptions,
  applyExpenseFiltersAndRender,
} from "../features/expenses/expenses.filters.js";
import { refreshExpensesFeature } from "../features/expenses/expenses.controller.js";
import {
  populateIncomeFilterOptions,
  applyIncomeFiltersAndRender,
} from "../features/incomes/incomes.filters.js";
import { refreshIncomesFeature } from "../features/incomes/incomes.controller.js";
import {
  loadAccountsAndFill,
  refreshBalances,
  initAccountEvents,
} from "../features/accounts/accounts.controller.js";
import { setActiveRoute, restoreLastRoute } from "./router.js";
import { watchAuth, auth, bindAuthButtons } from "../services/firebase/auth.js";
import {
  initMonthFilter,
  getMonthValue,
  showToast,
  setGlobalLoading,
  updateUserMenuUI,
  updateNavbarStats,
  sumAmounts,
} from "../shared/ui/core.js";
import { fillAccountSelect } from "../shared/ui/tables.js";
import {
  addExpense,
  getExpense,
  updateExpense,
  deleteExpense,
  addIncome,
  getIncome,
  updateIncome,
  deleteIncome,
} from "../services/firebase/firestore.js";
import { exportCsvCurrentMonth } from "../features/export/exportCsv.js";
import { suggestCategory } from "../services/api/aiCategorize.js";
import { AI_BACKGROUND_ENABLED } from "../shared/constants/featureFlags.js";
import {
  loadGoalsData,
  createGoal,
  saveGoalProgress,
  markGoalDone,
  removeGoal,
  createHabit,
  removeHabit,
  checkInHabit,
} from "../features/goals/goals.controller.js";
import {
  renderGoalsTable,
  renderHabitsTable,
  renderGoalsSummary,
  renderGoalsDailyFocus,
} from "../features/goals/goals.ui.js";
import { getMotivationSummary } from "../features/motivation/motivation.controller.js";
import {
  renderMotivationDashboard,
  renderMotivationDetails,
  buildDefaultMotivationSummary,
} from "../features/motivation/motivation.ui.js";
import {
  loadVideoTasks,
  createVideoTask,
  moveTaskToStage,
  removeVideoTask,
  updateVideoTaskDetails,
} from "../features/videoPlan/videoPlan.controller.js";
import {
  createDefaultVideoFilters,
  loadVideoFilters,
  saveVideoFilters,
  hydrateVideoFilterControls,
  readVideoFiltersFromControls,
  filterVideoTasks,
  renderVideoFilterSummary,
  renderVideoBoard,
  renderVideoSummary,
  VIDEO_STAGES,
} from "../features/videoPlan/videoPlan.ui.js";
import { buildDashboardCommandCenterVM } from "../features/dashboard/dashboard.controller.js";
import { renderDashboardCommandCenter } from "../features/dashboard/dashboard.ui.js";
import { t, formatTemplate } from "../shared/constants/copy.vi.js";

const state = {
  currentUser: null,
  accounts: [],
  accountBalances: [],
  allExpenses: [],
  allIncomes: [],
  goals: [],
  habits: [],
  todayHabitLogs: [],
  habitProgress: {},
  videoTasks: [],
  motivation: buildDefaultMotivationSummary(),
  videoFilters: loadVideoFilters(),
  expenseFilters: { category: "all", account: "all", search: "" },
  incomeFilters: { account: "all", search: "" },
  expTotal: 0,
  incTotal: 0,
  pendingDeleteExpenseId: null,
  pendingDeleteIncomeId: null,
  aiTimer: null,
};

const bindState = {
  dashboard: false,
  video: false,
};

function byId(id) {
  return document.getElementById(id);
}

function setInputValue(id, value = "") {
  const el = byId(id);
  if (el) el.value = value;
}

function localizeStaticVietnamese() {
  document.documentElement.lang = "vi";
  document.title = t("brand.name", "NEXUS OS");
  byId("btnSidebarToggle")?.setAttribute("aria-label", "Mở điều hướng");
  byId("appToast")
    ?.querySelector(".btn-close")
    ?.setAttribute("aria-label", t("common.close", "Đóng"));
  const loadingText = document.querySelector("#appLoading .small");
  if (loadingText) {
    loadingText.textContent = t("common.loading", "Đang tải dữ liệu...");
  }
  updateNavbarStats(state.expTotal, state.incTotal);
  document.documentElement.setAttribute("data-i18n-ready", "true");
}

function ensureUser() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    showToast(t("toast.signInRequired", "Vui lòng đăng nhập trước"), "error");
    return null;
  }
  return uid;
}

function toInputDate(value) {
  if (!value) return "";
  const d = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function syncIncomeMonthFilterOptions() {
  const globalSel = byId("monthFilter");
  const incomeSel = byId("incomeMonthFilter");
  if (!globalSel || !incomeSel) return;

  incomeSel.innerHTML = globalSel.innerHTML;
  incomeSel.value = globalSel.value;
}

function seedDateInActiveMonth() {
  const ym = getMonthValue();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return new Date().toISOString().slice(0, 10);
  }

  const [y, m] = ym.split("-").map(Number);
  const now = new Date();
  const maxDay = new Date(y, m, 0).getDate();
  const day = Math.min(now.getDate(), maxDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function updateMonthBadge() {
  const badge = byId("monthBadge");
  if (!badge) return;

  const ym = getMonthValue();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    badge.textContent = "--/----";
    return;
  }

  const [y, m] = ym.split("-");
  badge.textContent = `${m}/${y}`;
}

function renderDashboardCenter() {
  const vm = buildDashboardCommandCenterVM(state, new Date());
  renderDashboardCommandCenter(vm);
}

function updateDashboardFinance({ expTotal, incTotal }) {
  state.expTotal = expTotal;
  state.incTotal = incTotal;

  updateNavbarStats(expTotal, incTotal);
  updateMonthBadge();
  renderDashboardCenter();
}

async function loadFinance(uid) {
  const [expensePack, incomePack] = await Promise.all([
    refreshExpensesFeature(uid, state.expenseFilters),
    refreshIncomesFeature(uid, state.incomeFilters),
  ]);

  state.allExpenses = Array.isArray(expensePack?.list) ? expensePack.list : [];
  state.allIncomes = Array.isArray(incomePack?.list) ? incomePack.list : [];
  state.expenseFilters = expensePack?.filters || state.expenseFilters;
  state.incomeFilters = incomePack?.filters || state.incomeFilters;

  populateExpenseFiltersOptions(state.allExpenses);
  populateIncomeFilterOptions(state.allIncomes);

  updateDashboardFinance({
    expTotal: sumAmounts(state.allExpenses),
    incTotal: sumAmounts(state.allIncomes),
  });
}

async function loadAccounts(uid) {
  const { accounts } = await loadAccountsAndFill(uid, "all");
  state.accounts = Array.isArray(accounts) ? accounts : [];
}

async function loadBalances(uid) {
  const balances = await refreshBalances(uid);
  state.accountBalances = Array.isArray(balances) ? balances : [];
  renderDashboardCenter();
}

async function loadGoals(uid) {
  const { goals, habits, todayLogs, habitProgress } = await loadGoalsData(uid);
  state.goals = Array.isArray(goals) ? goals : [];
  state.habits = Array.isArray(habits) ? habits : [];
  state.todayHabitLogs = Array.isArray(todayLogs) ? todayLogs : [];
  state.habitProgress = habitProgress && typeof habitProgress === "object" ? habitProgress : {};

  renderGoalsTable(byId("goalsTableBody"), state.goals);
  renderHabitsTable(byId("habitsTableBody"), state.habits, state.habitProgress);
  renderGoalsDailyFocus(byId("goalsDailyFocus"), state.habits, state.habitProgress);
  renderGoalsSummary(byId("dashboardGoalsSummary"), state.goals);
  renderDashboardCenter();
}

async function loadMotivation(uid) {
  const summary = await getMotivationSummary(uid);
  state.motivation = summary || buildDefaultMotivationSummary();

  renderMotivationDashboard(byId("dashboardMotivation"), state.motivation);
  renderMotivationDetails(state.motivation);
  renderDashboardCenter();
}

function renderVideoBoardWithFilters() {
  const filteredTasks = filterVideoTasks(state.videoTasks, state.videoFilters);
  renderVideoBoard(filteredTasks);
  renderVideoFilterSummary(byId("videoFilterSummary"), filteredTasks.length, state.videoTasks.length);
}

function syncVideoFilterControls() {
  hydrateVideoFilterControls(state.videoFilters);
}

async function loadVideo(uid) {
  const tasks = await loadVideoTasks(uid);
  state.videoTasks = Array.isArray(tasks) ? tasks : [];

  syncVideoFilterControls();
  renderVideoBoardWithFilters();
  renderVideoSummary(byId("dashboardVideoSummary"), state.videoTasks);
  renderDashboardCenter();
}

async function refreshAll(uid) {
  if (!uid) return;

  setGlobalLoading(true);
  try {
    await Promise.all([
      loadAccounts(uid),
      loadFinance(uid),
      loadGoals(uid),
      loadVideo(uid),
      loadMotivation(uid),
      loadBalances(uid),
    ]);
  } catch (err) {
    console.error("refreshAll error", err);
    showToast(t("toast.loadFail", "Không thể tải dữ liệu. Vui lòng thử lại."), "error");
  } finally {
    setGlobalLoading(false);
  }
}

async function refreshAfterTransaction(uid) {
  if (!uid) return;
  await Promise.all([loadFinance(uid), loadBalances(uid)]);
}

async function refreshGoalsAndMotivation(uid) {
  if (!uid) return;
  await Promise.all([loadGoals(uid), loadMotivation(uid)]);
}

async function refreshVideoAndMotivation(uid) {
  if (!uid) return;
  await Promise.all([loadVideo(uid), loadMotivation(uid)]);
}

function resetAppView() {
  state.currentUser = null;
  state.accounts = [];
  state.accountBalances = [];
  state.allExpenses = [];
  state.allIncomes = [];
  state.goals = [];
  state.habits = [];
  state.todayHabitLogs = [];
  state.habitProgress = {};
  state.videoTasks = [];
  state.motivation = buildDefaultMotivationSummary();
  state.expTotal = 0;
  state.incTotal = 0;
  state.pendingDeleteExpenseId = null;
  state.pendingDeleteIncomeId = null;

  updateNavbarStats(0, 0);
  updateDashboardFinance({ expTotal: 0, incTotal: 0 });

  applyExpenseFiltersAndRender([], state.expenseFilters);
  applyIncomeFiltersAndRender([], state.incomeFilters);
  renderGoalsTable(byId("goalsTableBody"), []);
  renderHabitsTable(byId("habitsTableBody"), [], {});
  renderGoalsSummary(byId("dashboardGoalsSummary"), []);
  renderVideoBoard([]);
  renderVideoSummary(byId("dashboardVideoSummary"), []);
  renderMotivationDashboard(byId("dashboardMotivation"), state.motivation);
  renderMotivationDetails(state.motivation);

  const balance = byId("balanceList");
  if (balance) balance.innerHTML = '<div class="text-muted">Chưa có dữ liệu</div>';

  const dashboardBalance = byId("dashboardAccountBalances");
  if (dashboardBalance) dashboardBalance.innerHTML = '<div class="text-muted small">Chưa có dữ liệu</div>';
}

function closeSidebar() {
  byId("navRail")?.classList.remove("show");
  byId("sidebarBackdrop")?.classList.remove("show");
}

function initSidebarToggle() {
  const btn = byId("btnSidebarToggle");
  const rail = byId("navRail");
  const backdrop = byId("sidebarBackdrop");

  btn?.addEventListener("click", () => {
    rail?.classList.toggle("show");
    backdrop?.classList.toggle("show");
  });

  backdrop?.addEventListener("click", closeSidebar);
  window.addEventListener("hashchange", closeSidebar);
}

function openConfirmDelete(type, id) {
  state.pendingDeleteExpenseId = type === "expense" ? id : null;
  state.pendingDeleteIncomeId = type === "income" ? id : null;

  const title = byId("confirmDeleteTitle");
  const text = byId("confirmDeleteText");

  if (title) {
    title.textContent = type === "expense" ? "Xóa khoản chi?" : "Xóa khoản thu?";
  }

  if (text) {
    text.textContent = "Hành động này không thể hoàn tác.";
  }

  bootstrap.Offcanvas.getOrCreateInstance(byId("confirmDeleteModal"))?.show();
}

async function handleConfirmDelete() {
  const uid = ensureUser();
  if (!uid) return;

  try {
    if (state.pendingDeleteExpenseId) {
      await deleteExpense(uid, state.pendingDeleteExpenseId);
      showToast(t("toast.expenseDeleted", "Đã xóa khoản chi."), "success");
    } else if (state.pendingDeleteIncomeId) {
      await deleteIncome(uid, state.pendingDeleteIncomeId);
      showToast(t("toast.incomeDeleted", "Đã xóa khoản thu."), "success");
    }

    bootstrap.Offcanvas.getOrCreateInstance(byId("confirmDeleteModal"))?.hide();
    state.pendingDeleteExpenseId = null;
    state.pendingDeleteIncomeId = null;

    await refreshAfterTransaction(uid);
  } catch (err) {
    console.error("handleConfirmDelete error", err);
    showToast(err?.message || t("toast.deleteDataFail", "Không thể xóa dữ liệu"), "error");
  }
}

async function suggestCategoryIfNeeded() {
  if (!AI_BACKGROUND_ENABLED) return;

  const name = (byId("eName")?.value || "").trim();
  if (!name) return;

  const note = (byId("eNote")?.value || "").trim();
  const categoryEl = byId("eCategory");
  if (!categoryEl) return;

  const categories = Array.from(categoryEl.options).map((option) => option.value);

  try {
    const data = await suggestCategory({ name, note, categories });
    if (data?.category && categories.includes(data.category)) {
      categoryEl.value = data.category;
    }
  } catch (err) {
    console.error("suggestCategory error", err);
  }
}

function bindExpenseEvents() {
  byId("addExpenseModal")?.addEventListener("show.bs.offcanvas", () => {
    fillAccountSelect(byId("eAccount"), state.accounts);
    const dateEl = byId("eDate");
    if (dateEl && !dateEl.value) {
      dateEl.value = seedDateInActiveMonth();
    }

    const errorBox = byId("aeError");
    errorBox?.classList.add("d-none");

    ["eName", "eAmount", "eNote"].forEach((id) => {
      const el = byId(id);
      if (el) el.value = "";
    });
  });

  byId("eName")?.addEventListener("input", () => {
    clearTimeout(state.aiTimer);
    state.aiTimer = setTimeout(() => {
      suggestCategoryIfNeeded();
    }, 500);
  });

  byId("btnAddExpense")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      name: (byId("eName")?.value || "").trim(),
      amount: byId("eAmount")?.value,
      date: byId("eDate")?.value,
      category: byId("eCategory")?.value || "Other",
      account: byId("eAccount")?.value,
      note: (byId("eNote")?.value || "").trim(),
    };

    try {
      await addExpense(uid, payload);
      bootstrap.Offcanvas.getOrCreateInstance(byId("addExpenseModal"))?.hide();
      showToast(t("toast.expenseAdded", "Đã thêm khoản chi."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("addExpense error", err);
      const errorBox = byId("aeError");
      if (errorBox) {
        errorBox.textContent = err?.message || "Không thể thêm khoản chi";
        errorBox.classList.remove("d-none");
      } else {
        showToast(err?.message || t("toast.expenseCreateFail", "Không thể thêm khoản chi"), "error");
      }
    }
  });

  byId("btnSaveExpense")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const id = byId("edId")?.value;
    if (!id) return;

    const payload = {
      name: (byId("edName")?.value || "").trim(),
      amount: byId("edAmount")?.value,
      date: byId("edDate")?.value,
      category: byId("edCategory")?.value || "Other",
      account: byId("edAccount")?.value,
      note: (byId("edNote")?.value || "").trim(),
    };

    try {
      await updateExpense(uid, id, payload);
      bootstrap.Offcanvas.getOrCreateInstance(byId("editExpenseModal"))?.hide();
      showToast(t("toast.expenseUpdated", "Đã cập nhật khoản chi."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("updateExpense error", err);
      showToast(err?.message || t("toast.expenseUpdateFail", "Không thể cập nhật khoản chi"), "error");
    }
  });

  byId("expensesTable")?.querySelector("tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    const row = e.target.closest("tr");
    if (!btn || !row?.dataset?.id) return;

    const id = row.dataset.id;

    if (btn.classList.contains("btn-expense-del")) {
      openConfirmDelete("expense", id);
      return;
    }

    if (!btn.classList.contains("btn-expense-edit")) return;

    const uid = ensureUser();
    if (!uid) return;

    try {
      const expense = await getExpense(uid, id);
      if (!expense) {
        showToast(t("toast.expenseNotFound", "Không tìm thấy khoản chi"), "error");
        return;
      }

      fillAccountSelect(byId("edAccount"), state.accounts);

      byId("edId").value = expense.id;
      byId("edName").value = expense.name || "";
      byId("edAmount").value = Number(expense.amount || 0);
      byId("edDate").value = toInputDate(expense.date);
      byId("edCategory").value = expense.category || "Other";

      const editAccount = byId("edAccount");
      if (editAccount) {
        const account = expense.account || "";
        if (account && !Array.from(editAccount.options).some((o) => o.value === account)) {
          editAccount.add(new Option(account, account, true, true));
        }
        editAccount.value = account;
      }

      byId("edNote").value = expense.note || "";
      bootstrap.Offcanvas.getOrCreateInstance(byId("editExpenseModal"))?.show();
    } catch (err) {
      console.error("open edit expense error", err);
      showToast(err?.message || t("toast.expenseOpenFail", "Không thể mở khoản chi"), "error");
    }
  });
}

function bindIncomeEvents() {
  byId("addIncomeModal")?.addEventListener("show.bs.offcanvas", () => {
    fillAccountSelect(byId("iAccount"), state.accounts);

    const dateEl = byId("iDate");
    if (dateEl && !dateEl.value) {
      dateEl.value = seedDateInActiveMonth();
    }
  });

  byId("btnAddIncome")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      name: (byId("iName")?.value || "").trim(),
      amount: byId("iAmount")?.value,
      date: byId("iDate")?.value,
      account: byId("iAccount")?.value,
      note: (byId("iNote")?.value || "").trim(),
    };

    try {
      await addIncome(uid, payload);
      bootstrap.Offcanvas.getOrCreateInstance(byId("addIncomeModal"))?.hide();

      ["iName", "iAmount", "iNote"].forEach((id) => {
        const el = byId(id);
        if (el) el.value = "";
      });

      showToast(t("toast.incomeAdded", "Đã thêm khoản thu."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("addIncome error", err);
      showToast(err?.message || t("toast.incomeCreateFail", "Không thể thêm khoản thu"), "error");
    }
  });

  byId("btnSaveIncome")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const id = byId("eiId")?.value;
    if (!id) return;

    const payload = {
      name: (byId("eiName")?.value || "").trim(),
      amount: byId("eiAmount")?.value,
      date: byId("eiDate")?.value,
      account: byId("eiAccount")?.value,
      note: (byId("eiNote")?.value || "").trim(),
    };

    try {
      await updateIncome(uid, id, payload);
      bootstrap.Offcanvas.getOrCreateInstance(byId("editIncomeModal"))?.hide();
      showToast(t("toast.incomeUpdated", "Đã cập nhật khoản thu."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("updateIncome error", err);
      showToast(err?.message || t("toast.incomeUpdateFail", "Không thể cập nhật khoản thu"), "error");
    }
  });

  byId("incomesTable")?.querySelector("tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    const row = e.target.closest("tr");
    if (!btn || !row?.dataset?.id) return;

    const id = row.dataset.id;

    if (btn.classList.contains("btn-income-del")) {
      openConfirmDelete("income", id);
      return;
    }

    if (!btn.classList.contains("btn-income-edit")) return;

    const uid = ensureUser();
    if (!uid) return;

    try {
      const income = await getIncome(uid, id);
      if (!income) {
        showToast(t("toast.incomeNotFound", "Không tìm thấy khoản thu"), "error");
        return;
      }

      fillAccountSelect(byId("eiAccount"), state.accounts);

      byId("eiId").value = income.id;
      byId("eiName").value = income.name || "";
      byId("eiAmount").value = Number(income.amount || 0);
      byId("eiDate").value = toInputDate(income.date);

      const editAccount = byId("eiAccount");
      if (editAccount) {
        const account = income.account || "";
        if (account && !Array.from(editAccount.options).some((o) => o.value === account)) {
          editAccount.add(new Option(account, account, true, true));
        }
        editAccount.value = account;
      }

      byId("eiNote").value = income.note || "";
      bootstrap.Offcanvas.getOrCreateInstance(byId("editIncomeModal"))?.show();
    } catch (err) {
      console.error("open edit income error", err);
      showToast(err?.message || t("toast.incomeOpenFail", "Không thể mở khoản thu"), "error");
    }
  });
}

function bindFilterEvents() {
  byId("filterCategory")?.addEventListener("change", () => {
    state.expenseFilters = applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
  });

  byId("filterAccount")?.addEventListener("change", () => {
    state.expenseFilters = applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
  });

  byId("filterSearch")?.addEventListener("input", () => {
    state.expenseFilters = applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
  });

  byId("incomeAccountFilter")?.addEventListener("change", () => {
    state.incomeFilters = applyIncomeFiltersAndRender(state.allIncomes, state.incomeFilters);
  });

  byId("incomeSearch")?.addEventListener("input", () => {
    state.incomeFilters = applyIncomeFiltersAndRender(state.allIncomes, state.incomeFilters);
  });

  const syncVideoFilters = () => {
    state.videoFilters = readVideoFiltersFromControls(state.videoFilters);
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
  };

  byId("videoFilterStage")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterPriority")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterQuery")?.addEventListener("input", syncVideoFilters);
  byId("btnVideoFilterReset")?.addEventListener("click", () => {
    state.videoFilters = createDefaultVideoFilters();
    syncVideoFilterControls();
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
  });
}

function bindMonthEvents() {
  byId("monthFilter")?.addEventListener("change", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const incomeMonth = byId("incomeMonthFilter");
    const monthFilter = byId("monthFilter");
    if (incomeMonth && monthFilter) {
      incomeMonth.value = monthFilter.value;
    }

    await refreshAll(uid);
  });

  byId("incomeMonthFilter")?.addEventListener("change", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const incomeMonth = byId("incomeMonthFilter");
    const monthFilter = byId("monthFilter");
    if (incomeMonth && monthFilter) {
      monthFilter.value = incomeMonth.value;
    }

    await refreshAll(uid);
  });
}

async function handleHabitCheckInAction(habitId) {
  const uid = ensureUser();
  if (!uid) return;

  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) {
    showToast(t("toast.habitNotFound", "Không tìm thấy thói quen"), "error");
    return;
  }

  const result = await checkInHabit(uid, habit);
  if (result?.status === "locked") {
    showToast(t("toast.habitLocked", "Bạn đã đạt mục tiêu kỳ này"), "info");
  } else {
    showToast(
      formatTemplate(t("toast.habitChecked", "Điểm danh thành công. +{{xp}} XP"), {
        xp: Number(habit.xpPerCheckin || 10),
      }),
      "success"
    );
  }

  await refreshGoalsAndMotivation(uid);
}

function bindDashboardEvents() {
  if (bindState.dashboard) return;
  bindState.dashboard = true;

  byId("dashPriorityList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-dash-priority-checkin");
    const habitId = btn?.dataset?.priorityId;
    if (!habitId) return;

    try {
      await handleHabitCheckInAction(habitId);
    } catch (err) {
      console.error("dashboard priority check-in error", err);
      showToast(err?.message || t("toast.habitUpdateFail", "Không thể cập nhật thói quen"), "error");
    }
  });

  window.addEventListener("nexus:balances-updated", (event) => {
    const balances = Array.isArray(event?.detail) ? event.detail : [];
    state.accountBalances = balances;
    renderDashboardCenter();
  });
}

function bindGoalEvents() {
  byId("btnAddGoal")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      title: (byId("goalTitle")?.value || "").trim(),
      area: byId("goalArea")?.value || "ca-nhan",
      period: byId("goalPeriod")?.value || "month",
      targetValue: Number(byId("goalTarget")?.value || 0),
      currentValue: 0,
      unit: (byId("goalUnit")?.value || "lần").trim(),
      dueDate: byId("goalDueDate")?.value || null,
      status: "active",
      priority: byId("goalPriority")?.value || "medium",
      note: (byId("goalNote")?.value || "").trim(),
    };

    try {
      await createGoal(uid, payload);
      ["goalTitle", "goalNote"].forEach((id) => {
        const el = byId(id);
        if (el) el.value = "";
      });
      setInputValue("goalTarget", "1");

      showToast(t("toast.goalAdded", "Đã tạo mục tiêu mới."), "success");
      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("createGoal error", err);
      showToast(err?.message || t("toast.goalCreateFail", "Không thể tạo mục tiêu"), "error");
    }
  });

  byId("btnAddHabit")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      name: (byId("habitName")?.value || "").trim(),
      period: byId("habitPeriod")?.value || "day",
      targetCount: Number(byId("habitTarget")?.value || 1),
      xpPerCheckin: Number(byId("habitXp")?.value || 10),
      active: true,
    };

    try {
      await createHabit(uid, payload);
      setInputValue("habitName", "");
      setInputValue("habitTarget", "1");
      setInputValue("habitXp", "10");

      showToast(t("toast.habitAdded", "Đã tạo thói quen mới."), "success");
      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("createHabit error", err);
      showToast(err?.message || t("toast.habitCreateFail", "Không thể tạo thói quen"), "error");
    }
  });

  byId("goalsTableBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    const row = e.target.closest("tr");
    if (!btn || !row?.dataset?.id) return;

    const uid = ensureUser();
    if (!uid) return;

    const goalId = row.dataset.id;
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal) return;

    try {
      if (btn.classList.contains("btn-goal-save")) {
        const current = row.querySelector(".goal-current-input")?.value;
        await saveGoalProgress(uid, goal.id, current, goal.targetValue);
        showToast(t("toast.goalProgressUpdated", "Đã cập nhật tiến độ mục tiêu."), "success");
      }

      if (btn.classList.contains("btn-goal-done")) {
        await markGoalDone(uid, goal.id);
        showToast(t("toast.goalDoneXp", "Đã hoàn thành mục tiêu. +120 XP"), "success");
      }

      if (btn.classList.contains("btn-goal-del")) {
        await removeGoal(uid, goal.id);
        showToast(t("toast.goalDeleted", "Đã xóa mục tiêu."), "success");
      }

      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("goal action error", err);
      showToast(err?.message || t("toast.goalUpdateFail", "Không thể cập nhật mục tiêu"), "error");
    }
  });

  byId("goalsDailyFocus")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-habit-focus-checkin");
    const habitId = btn?.dataset?.id;
    if (!habitId) return;

    try {
      await handleHabitCheckInAction(habitId);
    } catch (err) {
      console.error("goals focus check-in error", err);
      showToast(err?.message || t("toast.habitUpdateFail", "Không thể cập nhật thói quen"), "error");
    }
  });

  byId("habitsTableBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    const row = e.target.closest("tr");
    if (!btn || !row?.dataset?.id) return;

    const uid = ensureUser();
    if (!uid) return;

    const habitId = row.dataset.id;
    const habit = state.habits.find((item) => item.id === habitId);
    if (!habit) return;

    try {
      if (btn.classList.contains("btn-habit-checkin")) {
        await handleHabitCheckInAction(habit.id);
        return;
      }

      if (btn.classList.contains("btn-habit-del")) {
        await removeHabit(uid, habit.id);
        showToast(t("toast.habitDeleted", "Đã xóa thói quen."), "success");
      }

      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("habit action error", err);
      showToast(err?.message || t("toast.habitUpdateFail", "Không thể cập nhật thói quen"), "error");
    }
  });
}

function bindVideoEvents() {
  if (bindState.video) return;
  bindState.video = true;

  const videoEditPanel = byId("editVideoTaskModal");

  const resetVideoEditForm = () => {
    const fields = [
      "evId",
      "evTitle",
      "evDeadline",
      "evScriptUrl",
      "evShotList",
      "evAssetLinks",
      "evNote",
    ];

    fields.forEach((id) => {
      const el = byId(id);
      if (el) el.value = "";
    });

    const priority = byId("evPriority");
    if (priority) priority.value = "medium";
  };

  const fillVideoEditForm = (task) => {
    if (!task) return;

    const setValue = (id, value = "") => {
      const el = byId(id);
      if (el) el.value = value;
    };

    setValue("evId", task.id || "");
    setValue("evTitle", task.title || "");
    setValue("evDeadline", toInputDate(task.deadline));
    setValue("evPriority", task.priority || "medium");
    setValue("evScriptUrl", task.scriptUrl || "");
    setValue("evShotList", task.shotList || "");
    setValue(
      "evAssetLinks",
      Array.isArray(task.assetLinks) ? task.assetLinks.join("\n") : String(task.assetLinks || "")
    );
    setValue("evNote", task.note || "");
  };

  videoEditPanel?.addEventListener("hidden.bs.offcanvas", resetVideoEditForm);

  byId("btnAddVideoTask")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      title: (byId("videoTitle")?.value || "").trim(),
      deadline: byId("videoDeadline")?.value || null,
      priority: byId("videoPriority")?.value || "medium",
      scriptUrl: (byId("videoScriptUrl")?.value || "").trim(),
      shotList: (byId("videoShotList")?.value || "").trim(),
      assetLinks: (byId("videoAssetLinks")?.value || "").trim(),
      note: (byId("videoNote")?.value || "").trim(),
      stage: "idea",
    };

    try {
      await createVideoTask(uid, payload);

      [
        "videoTitle",
        "videoDeadline",
        "videoScriptUrl",
        "videoShotList",
        "videoAssetLinks",
        "videoNote",
      ].forEach((id) => {
        const el = byId(id);
        if (el) el.value = "";
      });
      setInputValue("videoPriority", "medium");

      showToast(t("toast.videoAdded", "Đã thêm công việc video mới."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("createVideoTask error", err);
      showToast(err?.message || t("toast.videoCreateFail", "Không thể tạo công việc video"), "error");
    }
  });

  const board = document.querySelector(".video-board");
  board?.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".video-card");
    if (!card) return;

    e.dataTransfer?.setData("text/plain", card.dataset.id || "");
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });

  board?.addEventListener("dragend", (e) => {
    const card = e.target.closest(".video-card");
    if (card) card.classList.remove("dragging");

    document.querySelectorAll(".video-stage-body.drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  });

  board?.addEventListener("click", async (e) => {
    const card = e.target.closest(".video-card");
    if (!card?.dataset?.id) return;

    const taskId = card.dataset.id;
    const editBtn = e.target.closest(".btn-video-edit");
    const deleteBtn = e.target.closest(".btn-video-del");

    if (editBtn) {
      const task = state.videoTasks.find((item) => item.id === taskId);
      if (!task) {
        showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
        return;
      }
      if (!videoEditPanel) {
        showToast(t("toast.videoUpdateFail", "Không thể cập nhật công việc video"), "error");
        return;
      }

      fillVideoEditForm(task);
      bootstrap.Offcanvas.getOrCreateInstance(videoEditPanel)?.show();
      return;
    }

    if (!deleteBtn) return;

    const uid = ensureUser();
    if (!uid) return;

    try {
      await removeVideoTask(uid, card.dataset.id);
      showToast(t("toast.videoDeleted", "Đã xóa công việc video."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("removeVideoTask error", err);
      showToast(err?.message || t("toast.videoDeleteFail", "Không thể xóa công việc video"), "error");
    }
  });

  byId("btnSaveVideoTask")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const taskId = (byId("evId")?.value || "").trim();
    if (!taskId) {
      showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
      return;
    }
    if (!state.videoTasks.some((item) => item.id === taskId)) {
      showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
      return;
    }

    const payload = {
      title: (byId("evTitle")?.value || "").trim(),
      deadline: byId("evDeadline")?.value || null,
      priority: byId("evPriority")?.value || "medium",
      scriptUrl: (byId("evScriptUrl")?.value || "").trim(),
      shotList: (byId("evShotList")?.value || "").trim(),
      assetLinks: (byId("evAssetLinks")?.value || "").trim(),
      note: (byId("evNote")?.value || "").trim(),
    };

    try {
      await updateVideoTaskDetails(uid, taskId, payload);
      if (videoEditPanel) {
        bootstrap.Offcanvas.getOrCreateInstance(videoEditPanel)?.hide();
      }
      showToast(t("toast.videoUpdated", "Đã cập nhật công việc video."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("updateVideoTaskDetails error", err);
      showToast(
        err?.message || t("toast.videoUpdateFail", "Không thể cập nhật công việc video"),
        "error"
      );
    }
  });

  document.querySelectorAll(".video-stage-body").forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");

      const uid = ensureUser();
      if (!uid) return;

      const taskId = e.dataTransfer?.getData("text/plain");
      const stage = zone.dataset.stage;

      if (!taskId || !VIDEO_STAGES.includes(stage)) return;

      const task = state.videoTasks.find((item) => item.id === taskId);
      if (!task) return;

      try {
        await moveTaskToStage(uid, task, stage);
        showToast(t("toast.videoMoved", "Đã chuyển bước công việc video."), "success");
        await refreshVideoAndMotivation(uid);
      } catch (err) {
        console.error("moveTaskToStage error", err);
        showToast(err?.message || t("toast.videoMoveFail", "Không thể chuyển bước"), "error");
      }
    });
  });
}

function bindExportEvent() {
  byId("btnExportCsv")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    try {
      await exportCsvCurrentMonth(uid);
      showToast(t("toast.csvExportSuccess", "Đã xuất CSV tháng hiện tại."), "success");
    } catch (err) {
      console.error("exportCsvCurrentMonth error", err);
      showToast(err?.message || t("toast.csvExportFail", "Xuất CSV thất bại"), "error");
    }
  });
}

localizeStaticVietnamese();
initMonthFilter();
syncIncomeMonthFilterOptions();
initSidebarToggle();
bindAuthButtons();
initAccountEvents();

bindExpenseEvents();
bindIncomeEvents();
bindFilterEvents();
bindMonthEvents();
bindDashboardEvents();
bindGoalEvents();
bindVideoEvents();
bindExportEvent();

byId("btnConfirmDelete")?.addEventListener("click", handleConfirmDelete);

watchAuth(async (user) => {
  state.currentUser = user || null;
  updateUserMenuUI(user || null);

  if (!user) {
    setActiveRoute("auth");
    resetAppView();
    return;
  }

  restoreLastRoute("dashboard");
  if (location.hash === "#auth") {
    setActiveRoute("dashboard");
  }
  await refreshAll(user.uid);
});
