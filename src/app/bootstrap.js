import { applyExpenseFiltersAndRender } from "../features/expenses/expenses.filters.js";
import { refreshExpensesFeature } from "../features/expenses/expenses.controller.js";
import { applyIncomeFiltersAndRender } from "../features/incomes/incomes.filters.js";
import { refreshIncomesFeature } from "../features/incomes/incomes.controller.js";
import {
  loadAccountsAndFill,
  refreshBalances,
  initAccountEvents,
} from "../features/accounts/accounts.controller.js";
import { setActiveRoute } from "./router.js";
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
  saveAppliedAiSuggestion,
} from "../services/firebase/firestore.js";
import { exportCsvCurrentMonth } from "../features/export/exportCsv.js";
import { suggestCategory } from "../services/api/aiCategorize.js";
import { getVideoCopilotSuggestions } from "../services/api/aiVideoCopilot.js";
import { getGoalSuggestions } from "../services/api/aiGoalSuggest.js";
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
import {
  buildDashboardCommandCenterVM,
} from "../features/dashboard/dashboard.controller.js";
import {
  renderDashboardCommandCenter,
  renderDashboardActionBoard,
} from "../features/dashboard/dashboard.ui.js";
import { initDashboardEvents } from "../features/dashboard/dashboard.events.js";
import {
  createDefaultSettings,
  loadSettings,
  applySettingsToApp,
  mergeSettingsPatch,
  persistSettingsPatch,
} from "../features/settings/settings.controller.js";
import {
  renderSettingsForm,
  renderSettingsSaveState,
  bindSettingsEvents,
} from "../features/settings/settings.ui.js";
import {
  buildWeeklyReviewVM,
  saveWeeklyReviewPlan,
  parseWeeklyPlanInput,
} from "../features/weeklyReview/weeklyReview.controller.js";
import {
  bindWeeklyReviewEvents,
  renderWeeklyReviewPage,
  renderWeeklyReviewSaveState,
} from "../features/weeklyReview/weeklyReview.ui.js";
import { t, formatTemplate } from "../shared/constants/copy.vi.js";

const SETTINGS_DEBOUNCE_MS = 700;
const AI_REQUEST_TIMEOUT_MS = 15000;
const AI_COOLDOWN_MS = 2000;
const AI_EXPENSE_DEBOUNCE_MS = 600;
const AI_EXPENSE_AUTO_CONFIDENCE = 0.75;
const DEFAULT_EXPENSE_FILTERS = { category: "all", account: "all", search: "" };
const DEFAULT_INCOME_FILTERS = { account: "all", search: "" };

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
  videoFilters: createDefaultVideoFilters(),
  expenseFilters: { ...DEFAULT_EXPENSE_FILTERS },
  incomeFilters: { ...DEFAULT_INCOME_FILTERS },
  settings: createDefaultSettings(),
  settingsSaveState: {
    status: "idle",
    savedAt: null,
  },
  settingsSaveTimer: null,
  settingsSavePendingPatch: null,
  settingsSaveVersion: 0,
  weeklyReviewVm: null,
  weeklyReviewSaveState: {
    status: "idle",
    savedAt: null,
  },
  expenseAiSuggestion: null,
  expenseAiRequestId: 0,
  videoAi: {
    loading: false,
    cooldownUntil: 0,
    mode: "generate",
    options: [],
    inputSnapshot: null,
  },
  goalAi: {
    loading: false,
    cooldownUntil: 0,
    mode: "generate",
    options: [],
    inputSnapshot: null,
  },
  expTotal: 0,
  incTotal: 0,
  pendingDeleteExpenseId: null,
  pendingDeleteIncomeId: null,
  aiTimer: null,
  aiCooldownUiTimer: null,
};

const bindState = {
  dashboard: false,
  video: false,
  weeklyReview: false,
  routeSync: false,
};

function byId(id) {
  return document.getElementById(id);
}

function setInputValue(id, value = "") {
  const el = byId(id);
  if (el) el.value = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function multilineToHtml(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function currentRouteId() {
  return String(location.hash || "").replace("#", "").trim() || "dashboard";
}

function currentHashRouteId() {
  return String(location.hash || "").replace("#", "").trim();
}

function isRouteActive(routeId) {
  return currentRouteId() === String(routeId || "").trim();
}

function isWeeklyReviewRouteActive() {
  return isRouteActive("weekly-review");
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergePatch(base = {}, patch = {}) {
  if (!isObject(base)) return { ...patch };
  if (!isObject(patch)) return { ...base };

  const next = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) return;
    if (isObject(value) && isObject(next[key])) {
      next[key] = mergePatch(next[key], value);
      return;
    }
    next[key] = value;
  });
  return next;
}

function isValidYm(value) {
  return /^\d{4}-\d{2}$/.test(String(value || "").trim());
}

function getCurrentYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function ensureMonthOption(selectEl, ym) {
  if (!selectEl || !isValidYm(ym)) return;
  if ([...selectEl.options].some((opt) => opt.value === ym)) return;

  const [year, month] = ym.split("-");
  selectEl.add(new Option(`Tháng ${month}/${year}`, ym));
}

function setMonthSelectors(ym) {
  if (!isValidYm(ym)) return;

  const monthFilter = byId("monthFilter");
  const incomeMonthFilter = byId("incomeMonthFilter");

  ensureMonthOption(monthFilter, ym);
  ensureMonthOption(incomeMonthFilter, ym);

  if (monthFilter) monthFilter.value = ym;
  if (incomeMonthFilter) incomeMonthFilter.value = ym;
}

function normalizeExpenseFilters(filters = {}) {
  return {
    category: String(filters?.category || "all"),
    account: String(filters?.account || "all"),
    search: String(filters?.search || "").trim(),
  };
}

function normalizeIncomeFilters(filters = {}) {
  return {
    account: String(filters?.account || "all"),
    search: String(filters?.search || "").trim(),
  };
}

function getDashboardPrefs() {
  return state?.settings?.preferences?.dashboard || createDefaultSettings().preferences.dashboard;
}

function resolvePostLoginRoute() {
  const hashRoute = currentHashRouteId();
  if (hashRoute && hashRoute !== "auth") return hashRoute;
  return getDashboardPrefs().startRoute || "dashboard";
}

function getFilterPrefs() {
  return state?.settings?.preferences?.filters || createDefaultSettings().preferences.filters;
}

function getLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function applyUiDensityPreference() {
  const density = state?.settings?.preferences?.ui?.density === "compact" ? "compact" : "comfortable";
  document.body.dataset.uiDensity = density;
}

function applyMonthPreferenceFromSettings() {
  const filters = getFilterPrefs();
  const nextMonth =
    filters.monthMode === "lastUsed" && isValidYm(filters.lastMonth) ? filters.lastMonth : getCurrentYm();
  setMonthSelectors(nextMonth);
  updateMonthBadge();
  return nextMonth;
}

function applyRememberedFiltersFromSettings() {
  const filters = getFilterPrefs();

  state.expenseFilters = filters.rememberExpenseFilters
    ? normalizeExpenseFilters(filters.expenseState || DEFAULT_EXPENSE_FILTERS)
    : { ...DEFAULT_EXPENSE_FILTERS };
  state.incomeFilters = filters.rememberIncomeFilters
    ? normalizeIncomeFilters(filters.incomeState || DEFAULT_INCOME_FILTERS)
    : { ...DEFAULT_INCOME_FILTERS };

  if (filters.rememberVideoFilters) {
    const rememberedVideo = mergePatch(createDefaultVideoFilters(), filters.videoState || {});
    const hasRememberedValue = Object.values(rememberedVideo).some(
      (value) => String(value || "").trim() !== "" && String(value) !== "all"
    );
    state.videoFilters = hasRememberedValue ? rememberedVideo : loadVideoFilters();
  } else {
    state.videoFilters = createDefaultVideoFilters();
  }

  saveVideoFilters(state.videoFilters);
}

function resetSettingsSave() {
  if (state.settingsSaveTimer) {
    clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }
  state.settingsSavePendingPatch = null;
  state.settingsSaveVersion += 1;
  state.settingsSaveState = {
    status: "idle",
    savedAt: null,
  };
  renderSettingsSaveState(state.settingsSaveState);
}

function resetWeeklyReviewSaveState() {
  state.weeklyReviewSaveState = {
    status: "idle",
    savedAt: null,
  };
  renderWeeklyReviewSaveState(state.weeklyReviewSaveState);
}

function setSettingsSaveState(next = {}) {
  state.settingsSaveState = {
    ...state.settingsSaveState,
    ...next,
  };
  renderSettingsSaveState(state.settingsSaveState);
}

function setWeeklyReviewSaveState(next = {}) {
  state.weeklyReviewSaveState = {
    ...state.weeklyReviewSaveState,
    ...next,
  };
  renderWeeklyReviewSaveState(state.weeklyReviewSaveState);
}

async function flushSettingsSave() {
  const uid = state.currentUser?.uid;
  if (!uid || !state.settingsSavePendingPatch) return;

  const patch = state.settingsSavePendingPatch;
  state.settingsSavePendingPatch = null;
  const version = ++state.settingsSaveVersion;

  setSettingsSaveState({ status: "saving" });
  try {
    await persistSettingsPatch(uid, patch);
    if (version === state.settingsSaveVersion) {
      setSettingsSaveState({
        status: "saved",
        savedAt: new Date(),
      });
    }
  } catch (err) {
    console.error("save settings error", err);
    if (version === state.settingsSaveVersion) {
      setSettingsSaveState({ status: "error" });
    }
  }

  if (state.settingsSavePendingPatch) {
    if (state.settingsSaveTimer) clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = setTimeout(() => {
      state.settingsSaveTimer = null;
      void flushSettingsSave();
    }, SETTINGS_DEBOUNCE_MS);
  }
}

function scheduleSettingsSave(immediate = false) {
  if (state.settingsSaveTimer) {
    clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }

  if (immediate) {
    void flushSettingsSave();
    return;
  }

  state.settingsSaveTimer = setTimeout(() => {
    state.settingsSaveTimer = null;
    void flushSettingsSave();
  }, SETTINGS_DEBOUNCE_MS);
}

function queueSettingsPatch(partialPatch, { immediate = false, silent = false } = {}) {
  if (!isObject(partialPatch)) return;

  state.settings = applySettingsToApp(state, mergeSettingsPatch(state.settings, partialPatch));
  state.settingsSavePendingPatch = mergePatch(state.settingsSavePendingPatch || {}, partialPatch);

  applyUiDensityPreference();

  if (!silent) {
    setSettingsSaveState({ status: "saving" });
  }

  if (!state.currentUser?.uid) return;
  scheduleSettingsSave(immediate);
}

function persistLastMonthFromUi({ immediate = false, silent = true } = {}) {
  const ym = byId("monthFilter")?.value || "";
  if (!isValidYm(ym)) return;

  queueSettingsPatch(
    {
      preferences: {
        filters: {
          lastMonth: ym,
        },
      },
    },
    { immediate, silent }
  );
}

function persistRememberedFilterState(filterKey, payload, { immediate = false } = {}) {
  const filters = getFilterPrefs();
  const rememberMap = {
    expenseState: !!filters.rememberExpenseFilters,
    incomeState: !!filters.rememberIncomeFilters,
    videoState: !!filters.rememberVideoFilters,
  };

  if (!rememberMap[filterKey]) return;
  queueSettingsPatch(
    {
      preferences: {
        filters: {
          [filterKey]: payload,
        },
      },
    },
    { immediate, silent: true }
  );
}

function applySettingsDerivedRuntime() {
  applyUiDensityPreference();
  applyRememberedFiltersFromSettings();
  const appliedMonth = applyMonthPreferenceFromSettings();
  state.settings = applySettingsToApp(
    state,
    mergeSettingsPatch(state.settings, {
      preferences: {
        filters: {
          lastMonth: appliedMonth,
        },
      },
    })
  );
}

async function loadUserSettingsAndApply(uid) {
  const loaded = await loadSettings(uid);
  state.settings = applySettingsToApp(state, loaded);
  resetSettingsSave();
  applySettingsDerivedRuntime();
  renderSettingsForm(state.settings, state.settingsSaveState);
}

function handleSettingsPatch(partialPatch, meta = {}) {
  queueSettingsPatch(partialPatch, { immediate: !!meta.immediate });

  const filtersPatch = partialPatch?.preferences?.filters;
  if (filtersPatch?.monthMode) {
    const month = applyMonthPreferenceFromSettings();
    queueSettingsPatch(
      {
        preferences: {
          filters: { lastMonth: month },
        },
      },
      { immediate: false, silent: true }
    );
    if (state.currentUser?.uid) {
      void refreshAll(state.currentUser.uid);
    }
  }

  if (filtersPatch?.rememberExpenseFilters === false) {
    state.expenseFilters = { ...DEFAULT_EXPENSE_FILTERS };
    applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
    queueSettingsPatch(
      {
        preferences: {
          filters: {
            expenseState: { ...DEFAULT_EXPENSE_FILTERS },
          },
        },
      },
      { immediate: false, silent: true }
    );
  } else if (filtersPatch?.rememberExpenseFilters === true) {
    persistRememberedFilterState("expenseState", state.expenseFilters);
  }

  if (filtersPatch?.rememberIncomeFilters === false) {
    state.incomeFilters = { ...DEFAULT_INCOME_FILTERS };
    applyIncomeFiltersAndRender(state.allIncomes, state.incomeFilters);
    queueSettingsPatch(
      {
        preferences: {
          filters: {
            incomeState: { ...DEFAULT_INCOME_FILTERS },
          },
        },
      },
      { immediate: false, silent: true }
    );
  } else if (filtersPatch?.rememberIncomeFilters === true) {
    persistRememberedFilterState("incomeState", state.incomeFilters);
  }

  if (filtersPatch?.rememberVideoFilters === false) {
    state.videoFilters = createDefaultVideoFilters();
    saveVideoFilters(state.videoFilters);
    syncVideoFilterControls();
    renderVideoBoardWithFilters();
    queueSettingsPatch(
      {
        preferences: {
          filters: {
            videoState: createDefaultVideoFilters(),
          },
        },
      },
      { immediate: false, silent: true }
    );
  } else if (filtersPatch?.rememberVideoFilters === true) {
    persistRememberedFilterState("videoState", state.videoFilters);
  }

  if (partialPatch?.preferences?.dashboard || partialPatch?.profile) {
    renderDashboardCenter();
    if (state.currentUser?.uid && isWeeklyReviewRouteActive()) {
      void loadWeeklyReview(state.currentUser.uid, state.weeklyReviewVm?.weekKey || "");
    }
  }
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
  const quickWeeklyReview = byId("btnQuickGoWeeklyReview");
  if (quickWeeklyReview) {
    quickWeeklyReview.textContent = t("cta.weeklyReview", "Tổng kết tuần");
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

async function saveAppliedAiSuggestionSafe(payload = {}) {
  const uid = state.currentUser?.uid;
  if (!uid) return;
  try {
    await saveAppliedAiSuggestion(uid, payload);
  } catch (err) {
    console.error("saveAppliedAiSuggestion error", err);
  }
}

function resetExpenseAiHint() {
  state.expenseAiSuggestion = null;
  const hint = byId("expenseAiHint");
  const applyBtn = byId("btnExpenseAiApply");
  if (hint) {
    hint.textContent = "";
    hint.classList.add("d-none");
    hint.classList.remove("ai-inline-hint-info", "ai-inline-hint-success", "ai-inline-hint-warning");
  }
  if (applyBtn) {
    applyBtn.classList.add("d-none");
    applyBtn.disabled = true;
  }
}

function renderExpenseAiHint(suggestion = {}, mode = "suggest") {
  const hint = byId("expenseAiHint");
  const applyBtn = byId("btnExpenseAiApply");
  if (!hint || !applyBtn) return;

  const category = String(suggestion?.category || "").trim();
  const confidence = Number(suggestion?.confidence || 0);
  const reason = String(suggestion?.reason || "").trim();
  if (!category) {
    resetExpenseAiHint();
    return;
  }

  const confidenceText = `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
  let text = formatTemplate(
    t("ai.expenseLabel.suggested", "AI đề xuất danh mục {{category}} (độ tin cậy {{confidence}})."),
    {
      category,
      confidence: confidenceText,
    }
  );

  hint.classList.remove("d-none", "ai-inline-hint-info", "ai-inline-hint-success", "ai-inline-hint-warning");
  applyBtn.classList.remove("d-none");
  applyBtn.disabled = false;

  if (mode === "auto") {
    text = formatTemplate(
      t("ai.expenseLabel.autoApplied", "AI đã tự gán danh mục {{category}} ({{confidence}})."),
      {
        category,
        confidence: confidenceText,
      }
    );
    hint.classList.add("ai-inline-hint-success");
    applyBtn.classList.add("d-none");
    applyBtn.disabled = true;
  } else if (mode === "manual") {
    text = formatTemplate(
      t("ai.expenseLabel.manualApplied", "Đã áp dụng danh mục {{category}} từ gợi ý AI."),
      {
        category,
      }
    );
    hint.classList.add("ai-inline-hint-success");
    applyBtn.classList.add("d-none");
    applyBtn.disabled = true;
  } else if (mode === "error") {
    text = t("ai.expenseLabel.errorHint", "Chưa thể gợi ý danh mục lúc này. Bạn vẫn có thể chọn thủ công.");
    hint.classList.add("ai-inline-hint-info");
    applyBtn.classList.add("d-none");
    applyBtn.disabled = true;
  } else {
    hint.classList.add("ai-inline-hint-warning");
    if (reason) {
      text += ` ${reason}`;
    }
  }

  hint.textContent = text;
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
  renderDashboardActionBoard(vm?.actionBoard || {});
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

function weeklyReviewOptions() {
  const dashboardPrefs = getDashboardPrefs();
  return {
    deadlineWindowHours: Number(dashboardPrefs?.deadlineWindowHours || 72),
    historyLimit: 12,
  };
}

async function loadWeeklyReview(uid, weekKey = "") {
  if (!uid) return;

  const targetWeekKey = String(weekKey || state.weeklyReviewVm?.weekKey || "").trim();
  const vm = await buildWeeklyReviewVM(uid, targetWeekKey, weeklyReviewOptions());
  state.weeklyReviewVm = vm;
  renderWeeklyReviewPage(vm, state.weeklyReviewSaveState);
}

async function refreshWeeklyReviewIfVisible(uid) {
  if (!uid || !isWeeklyReviewRouteActive()) return;
  await loadWeeklyReview(uid, state.weeklyReviewVm?.weekKey || "");
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
    await refreshWeeklyReviewIfVisible(uid);
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
  await refreshWeeklyReviewIfVisible(uid);
}

async function refreshGoalsAndMotivation(uid) {
  if (!uid) return;
  await Promise.all([loadGoals(uid), loadMotivation(uid)]);
  await refreshWeeklyReviewIfVisible(uid);
}

async function refreshVideoAndMotivation(uid) {
  if (!uid) return;
  await Promise.all([loadVideo(uid), loadMotivation(uid)]);
  await refreshWeeklyReviewIfVisible(uid);
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
  state.weeklyReviewVm = null;
  state.expenseAiSuggestion = null;
  state.expenseAiRequestId = 0;
  state.videoAi = {
    loading: false,
    cooldownUntil: 0,
    mode: "generate",
    options: [],
    inputSnapshot: null,
  };
  state.goalAi = {
    loading: false,
    cooldownUntil: 0,
    mode: "generate",
    options: [],
    inputSnapshot: null,
  };
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
  clearAiCooldownUiTimer();
  state.videoFilters = createDefaultVideoFilters();
  state.expenseFilters = { ...DEFAULT_EXPENSE_FILTERS };
  state.incomeFilters = { ...DEFAULT_INCOME_FILTERS };
  state.settings = applySettingsToApp(state, createDefaultSettings());
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
  renderVideoAiSuggestions();
  setVideoAiButtonsState();
  renderGoalAiSuggestions();
  setGoalAiButtonsState();
  resetExpenseAiHint();
  renderMotivationDashboard(byId("dashboardMotivation"), state.motivation);
  renderMotivationDetails(state.motivation);
  renderWeeklyReviewPage(null, state.weeklyReviewSaveState);

  const balance = byId("balanceList");
  if (balance) balance.innerHTML = '<div class="text-muted">Chưa có dữ liệu</div>';

  const dashboardBalance = byId("dashboardAccountBalances");
  if (dashboardBalance) dashboardBalance.innerHTML = '<div class="text-muted small">Chưa có dữ liệu</div>';

  resetSettingsSave();
  resetWeeklyReviewSaveState();
  renderSettingsForm(state.settings, state.settingsSaveState);
  applyUiDensityPreference();
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

function buildExpenseAiHistorySamples(allowedCategories = [], limitCount = 30) {
  const categorySet = new Set(
    (Array.isArray(allowedCategories) ? allowedCategories : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const safeLimit = Math.min(60, Math.max(0, Number(limitCount || 30)));
  if (!safeLimit) return [];

  return (Array.isArray(state.allExpenses) ? state.allExpenses : [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      note: String(item?.note || "").trim(),
      category: String(item?.category || "").trim(),
    }))
    .filter((item) => item.name && item.category)
    .filter((item) => !categorySet.size || categorySet.has(item.category))
    .slice(0, safeLimit);
}

async function suggestCategoryIfNeeded() {
  if (!AI_BACKGROUND_ENABLED) return;

  const name = (byId("eName")?.value || "").trim();
  if (!name) {
    resetExpenseAiHint();
    return;
  }

  const note = (byId("eNote")?.value || "").trim();
  const categoryEl = byId("eCategory");
  if (!categoryEl) return;

  const categories = Array.from(categoryEl.options).map((option) => option.value);
  const history = buildExpenseAiHistorySamples(categories, 36);
  const requestId = ++state.expenseAiRequestId;

  try {
    const data = await suggestCategory({ name, note, categories, history });
    if (requestId !== state.expenseAiRequestId) return;

    const category = String(data?.category || "").trim();
    const confidence = Number(data?.confidence || 0);
    const reason = String(data?.reason || "").trim();
    if (!category || !categories.includes(category)) {
      resetExpenseAiHint();
      return;
    }

    const suggestion = {
      category,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      reason,
      inputSnapshot: {
        name,
        note,
      },
    };

    if (suggestion.confidence >= AI_EXPENSE_AUTO_CONFIDENCE) {
      categoryEl.value = suggestion.category;
      state.expenseAiSuggestion = null;
      renderExpenseAiHint(suggestion, "auto");
      await saveAppliedAiSuggestionSafe({
        type: "expense-label",
        mode: "auto-label",
        inputSnapshot: suggestion.inputSnapshot,
        appliedOutput: {
          category: suggestion.category,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        },
        appliedAt: new Date(),
      });
      return;
    }

    state.expenseAiSuggestion = suggestion;
    renderExpenseAiHint(suggestion, "suggest");
  } catch (err) {
    console.error("suggestCategory error", err);
    if (requestId !== state.expenseAiRequestId) return;
    state.expenseAiSuggestion = null;
    renderExpenseAiHint({}, "error");
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
    clearTimeout(state.aiTimer);
    state.expenseAiRequestId += 1;
    resetExpenseAiHint();
  });

  const queueExpenseAiSuggest = () => {
    clearTimeout(state.aiTimer);
    state.aiTimer = setTimeout(() => {
      void suggestCategoryIfNeeded();
    }, AI_EXPENSE_DEBOUNCE_MS);
  };

  byId("eName")?.addEventListener("input", queueExpenseAiSuggest);
  byId("eNote")?.addEventListener("input", queueExpenseAiSuggest);

  byId("btnExpenseAiApply")?.addEventListener("click", async () => {
    const suggestion = state.expenseAiSuggestion;
    if (!suggestion?.category) return;
    const categoryEl = byId("eCategory");
    if (!categoryEl) return;
    if (!Array.from(categoryEl.options).some((opt) => opt.value === suggestion.category)) return;

    categoryEl.value = suggestion.category;
    renderExpenseAiHint(suggestion, "manual");
    state.expenseAiSuggestion = null;
    await saveAppliedAiSuggestionSafe({
      type: "expense-label",
      mode: "generate",
      inputSnapshot: suggestion.inputSnapshot || {},
      appliedOutput: {
        category: suggestion.category,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
      },
      appliedAt: new Date(),
    });
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
    persistRememberedFilterState("expenseState", state.expenseFilters);
  });

  byId("filterAccount")?.addEventListener("change", () => {
    state.expenseFilters = applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
    persistRememberedFilterState("expenseState", state.expenseFilters);
  });

  byId("filterSearch")?.addEventListener("input", () => {
    state.expenseFilters = applyExpenseFiltersAndRender(state.allExpenses, state.expenseFilters);
    persistRememberedFilterState("expenseState", state.expenseFilters);
  });

  byId("incomeAccountFilter")?.addEventListener("change", () => {
    state.incomeFilters = applyIncomeFiltersAndRender(state.allIncomes, state.incomeFilters);
    persistRememberedFilterState("incomeState", state.incomeFilters);
  });

  byId("incomeSearch")?.addEventListener("input", () => {
    state.incomeFilters = applyIncomeFiltersAndRender(state.allIncomes, state.incomeFilters);
    persistRememberedFilterState("incomeState", state.incomeFilters);
  });

  const syncVideoFilters = () => {
    state.videoFilters = readVideoFiltersFromControls(state.videoFilters);
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
    persistRememberedFilterState("videoState", state.videoFilters);
  };

  byId("videoFilterStage")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterPriority")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterQuery")?.addEventListener("input", syncVideoFilters);
  byId("btnVideoFilterReset")?.addEventListener("click", () => {
    state.videoFilters = createDefaultVideoFilters();
    syncVideoFilterControls();
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
    persistRememberedFilterState("videoState", state.videoFilters);
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

    persistLastMonthFromUi();
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

    persistLastMonthFromUi();
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

function getCooldownSeconds(cooldownUntil = 0) {
  return Math.max(0, Math.ceil((Number(cooldownUntil || 0) - Date.now()) / 1000));
}

function clearAiCooldownUiTimer() {
  if (!state.aiCooldownUiTimer) return;
  clearTimeout(state.aiCooldownUiTimer);
  state.aiCooldownUiTimer = null;
}

function scheduleAiCooldownUiTick() {
  clearAiCooldownUiTimer();
  const hasVideoCooldown = getCooldownSeconds(state.videoAi.cooldownUntil) > 0;
  const hasGoalCooldown = getCooldownSeconds(state.goalAi.cooldownUntil) > 0;
  if (!hasVideoCooldown && !hasGoalCooldown) return;

  state.aiCooldownUiTimer = setTimeout(() => {
    setVideoAiButtonsState();
    setGoalAiButtonsState();
    scheduleAiCooldownUiTick();
  }, 1000);
}

function renderVideoAiSuggestions() {
  const root = byId("videoAiSuggestionList");
  if (!root) return;
  const options = Array.isArray(state.videoAi.options) ? state.videoAi.options : [];

  if (!options.length) {
    root.innerHTML = `<div class="ai-suggestion-empty">${t(
      "ai.videoCopilot.empty",
      "B\u1ea5m AI g\u1ee3i \u00fd \u0111\u1ec3 nh\u1eadn ph\u01b0\u01a1ng \u00e1n video theo ng\u1eef c\u1ea3nh hi\u1ec7n t\u1ea1i."
    )}</div>`;
    return;
  }

  root.innerHTML = options
    .map((item, index) => {
      const title =
        String(item?.title || "").trim() ||
        t("ai.videoCopilot.optionUntitled", "Ph\u01b0\u01a1ng \u00e1n ch\u01b0a c\u00f3 ti\u00eau \u0111\u1ec1");
      const priority = String(item?.priority || "medium").trim();
      const deadline = String(item?.deadlineSuggestion || "").trim();
      const note = String(item?.note || "").trim();
      const shotList = String(item?.shotList || "").trim();
      const reason = String(item?.reason || "").trim();
      const optionIndexLabel = formatTemplate(
        t("ai.videoCopilot.optionIndex", "Ph\u01b0\u01a1ng \u00e1n {{index}}"),
        { index: index + 1 }
      );
      const safeTitle = escapeHtml(title);
      const safePriority = escapeHtml(priority);
      const safeReason = multilineToHtml(reason);
      const safeShotList = multilineToHtml(shotList);
      const safeNote = multilineToHtml(note);
      return `
        <article class="ai-suggestion-card">
          <div class="ai-suggestion-card-head">
            <div class="d-flex flex-column gap-1">
              <span class="ai-suggestion-index">${escapeHtml(optionIndexLabel)}</span>
              <strong>${safeTitle}</strong>
            </div>
            <span class="badge text-bg-light">${safePriority}</span>
          </div>
          <div class="ai-suggestion-meta small text-muted">
            ${
              deadline
                ? `${t("ai.videoCopilot.deadline", "H\u1ea1n g\u1ee3i \u00fd")}: ${escapeHtml(deadline)}`
                : t("ai.videoCopilot.noDeadline", "Kh\u00f4ng c\u00f3 h\u1ea1n g\u1ee3i \u00fd")
            }
          </div>
          ${
            reason
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.reasonLabel", "L\u00fd do g\u1ee3i \u00fd")}</div>
                   <div class="small">${safeReason}</div>
                 </div>`
              : ""
          }
          ${
            shotList
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.shotListLabel", "Danh s\u00e1ch c\u1ea3nh quay")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeShotList}</div>
                 </div>`
              : ""
          }
          ${
            note
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.noteLabel", "Ghi ch\u00fa tri\u1ec3n khai")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeNote}</div>
                 </div>`
              : ""
          }
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary btn-video-ai-apply" data-index="${index}">
              ${t("ai.common.apply", "\u00c1p d\u1ee5ng to\u00e0n b\u1ed9")}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function setVideoAiButtonsState() {
  const generateBtn = byId("btnVideoAiGenerate");
  const improveBtn = byId("btnVideoAiImprove");
  const cooldownSec = getCooldownSeconds(state.videoAi.cooldownUntil);
  const loading = !!state.videoAi.loading;
  const onCooldown = cooldownSec > 0;

  if (generateBtn) {
    generateBtn.disabled = loading || onCooldown;
    generateBtn.textContent = loading
      ? t("ai.videoCopilot.generateLoading", "Đang tạo gợi ý...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thử lại sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.videoCopilot.generate", "AI gợi ý mới");
  }

  if (improveBtn) {
    improveBtn.disabled = loading || onCooldown;
    improveBtn.textContent = loading
      ? t("ai.videoCopilot.improveLoading", "Đang cải thiện...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thử lại sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.videoCopilot.improve", "AI cải thiện nội dung");
  }
}

function readVideoFormInput() {
  return {
    title: (byId("videoTitle")?.value || "").trim(),
    deadline: byId("videoDeadline")?.value || "",
    priority: byId("videoPriority")?.value || "medium",
    scriptUrl: (byId("videoScriptUrl")?.value || "").trim(),
    shotList: (byId("videoShotList")?.value || "").trim(),
    assetLinks: (byId("videoAssetLinks")?.value || "").trim(),
    note: (byId("videoNote")?.value || "").trim(),
  };
}

function detectVideoLanguageHint(input = {}) {
  const selected = String(byId("videoAiLanguage")?.value || "").trim().toLowerCase();
  if (selected === "python" || selected === "javascript") {
    return selected;
  }

  const text = [
    String(input?.title || ""),
    String(input?.note || ""),
    String(input?.shotList || ""),
  ]
    .join(" ")
    .toLowerCase();

  const hasPython = /\bpython\b/.test(text);
  const hasJavascript = /\bjavascript\b|\bjs\b|java script/.test(text);

  if (hasPython && !hasJavascript) return "python";
  if (hasJavascript && !hasPython) return "javascript";
  return "python";
}

function buildVideoAiContext() {
  const profile = state?.settings?.profile || {};
  return {
    channelFocus:
      "Kênh YouTube hướng dẫn lập trình qua dự án thực tế đơn giản, dễ hiểu cho học sinh và người mới bắt đầu.",
    targetAudience: "Học sinh, sinh viên và người mới bắt đầu học lập trình",
    preferredTopics: [
      "Dự án Python cơ bản",
      "Dự án JavaScript cơ bản",
      "Ứng dụng thực tế dễ triển khai",
    ],
    tone: "Thực chiến, dễ hiểu, có checklist từng bước",
    ownerName: String(profile?.displayName || "Hưng Trần").trim(),
    ownerTagline: String(profile?.tagline || "").trim(),
  };
}

function applyVideoSuggestion(option = {}) {
  if (!option || typeof option !== "object") return;
  setInputValue("videoTitle", String(option?.title || "").trim());
  setInputValue("videoPriority", String(option?.priority || "medium").trim() || "medium");
  setInputValue("videoShotList", String(option?.shotList || "").trim());
  setInputValue("videoAssetLinks", String(option?.assetLinks || "").trim());
  setInputValue("videoNote", String(option?.note || "").trim());
  const deadline = String(option?.deadlineSuggestion || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    setInputValue("videoDeadline", deadline);
  }
}

async function handleVideoAiAction(mode = "generate") {
  const uid = ensureUser();
  if (!uid) return;
  if (state.videoAi.loading) return;

  const cooldownSec = getCooldownSeconds(state.videoAi.cooldownUntil);
  if (cooldownSec > 0) {
    showToast(
      formatTemplate(t("ai.common.cooldownToast", "Vui lòng chờ {{sec}} giây trước khi gọi AI tiếp theo."), {
        sec: cooldownSec,
      }),
      "info"
    );
    return;
  }

  state.videoAi.loading = true;
  state.videoAi.mode = mode === "improve" ? "improve" : "generate";
  setVideoAiButtonsState();
  try {
    const inputSnapshot = readVideoFormInput();
    state.videoAi.inputSnapshot = inputSnapshot;
    const res = await getVideoCopilotSuggestions(
      {
        mode: state.videoAi.mode,
        input: inputSnapshot,
        language: detectVideoLanguageHint(inputSnapshot),
        context: buildVideoAiContext(),
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );

    state.videoAi.options = Array.isArray(res?.options) ? res.options.slice(0, 3) : [];
    renderVideoAiSuggestions();
    showToast(
      res?.fallback
        ? t(
            "toast.videoAiFallback",
            "AI đang dùng mẫu gợi ý cục bộ. Bạn vẫn có thể bấm tạo lại để lấy phương án mới."
          )
        : t("toast.videoAiReady", "AI đã tạo 3 phương án video."),
      res?.fallback ? "info" : "success"
    );
  } catch (err) {
    console.error("handleVideoAiAction error", err);
    state.videoAi.options = [];
    renderVideoAiSuggestions();
    showToast(
      err?.message || t("toast.videoAiFail", "Không thể tạo gợi ý video lúc này."),
      "error"
    );
  } finally {
    state.videoAi.loading = false;
    state.videoAi.cooldownUntil = Date.now() + AI_COOLDOWN_MS;
    setVideoAiButtonsState();
    scheduleAiCooldownUiTick();
  }
}

function renderGoalAiSuggestions() {
  const root = byId("goalAiSuggestionList");
  if (!root) return;
  const options = Array.isArray(state.goalAi.options) ? state.goalAi.options : [];

  if (!options.length) {
    root.innerHTML = `<div class="ai-suggestion-empty">${t(
      "ai.goalCopilot.empty",
      "Bấm AI gợi ý để nhận bundle mục tiêu và thói quen phù hợp."
    )}</div>`;
    return;
  }

  root.innerHTML = options
    .map((item, index) => {
      const goal = item?.goal || {};
      const habit = item?.habit || {};
      const goalTitle = String(goal?.title || "").trim() || t("ai.goalCopilot.optionUntitled", "Mục tiêu chưa có tên");
      const habitName = String(habit?.name || "").trim() || t("ai.goalCopilot.habitUntitled", "Thói quen chưa có tên");
      const reason = String(item?.reason || "").trim();
      const safeGoalTitle = escapeHtml(goalTitle);
      const safeHabitName = escapeHtml(habitName);
      const safeReason = multilineToHtml(reason);
      const safePeriod = escapeHtml(String(goal?.period || "month"));
      return `
        <article class="ai-suggestion-card">
          <div class="ai-suggestion-card-head">
            <strong>${safeGoalTitle}</strong>
            <span class="badge text-bg-light">${safePeriod}</span>
          </div>
          <div class="small mt-1">${t("ai.goalCopilot.habitLabel", "Thói quen đi kèm")}: ${safeHabitName}</div>
          ${reason ? `<div class="small mt-1 text-muted">${safeReason}</div>` : ""}
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary btn-goal-ai-apply" data-index="${index}">
              ${t("ai.common.apply", "Áp dụng toàn bộ")}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function setGoalAiButtonsState() {
  const generateBtn = byId("btnGoalAiGenerate");
  const improveBtn = byId("btnGoalAiImprove");
  const cooldownSec = getCooldownSeconds(state.goalAi.cooldownUntil);
  const loading = !!state.goalAi.loading;
  const onCooldown = cooldownSec > 0;

  if (generateBtn) {
    generateBtn.disabled = loading || onCooldown;
    generateBtn.textContent = loading
      ? t("ai.goalCopilot.generateLoading", "Đang tạo gợi ý...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thử lại sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.goalCopilot.generate", "AI gợi ý mới");
  }

  if (improveBtn) {
    improveBtn.disabled = loading || onCooldown;
    improveBtn.textContent = loading
      ? t("ai.goalCopilot.improveLoading", "Đang cải thiện...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thử lại sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.goalCopilot.improve", "AI cải thiện nội dung");
  }
}

function readGoalContextInput() {
  return {
    goal: {
      title: (byId("goalTitle")?.value || "").trim(),
      area: byId("goalArea")?.value || "ca-nhan",
      period: byId("goalPeriod")?.value || "month",
      targetValue: Number(byId("goalTarget")?.value || 1),
      unit: (byId("goalUnit")?.value || "lần").trim(),
      dueDate: byId("goalDueDate")?.value || "",
      priority: byId("goalPriority")?.value || "medium",
      note: (byId("goalNote")?.value || "").trim(),
    },
    habit: {
      name: (byId("habitName")?.value || "").trim(),
      period: byId("habitPeriod")?.value || "day",
      targetCount: Number(byId("habitTarget")?.value || 1),
      xpPerCheckin: Number(byId("habitXp")?.value || 10),
    },
  };
}

function applyGoalBundle(option = {}) {
  const goal = option?.goal || {};
  const habit = option?.habit || {};
  setInputValue("goalTitle", String(goal?.title || "").trim());
  setInputValue("goalArea", String(goal?.area || "ca-nhan"));
  setInputValue("goalPeriod", String(goal?.period || "month"));
  setInputValue("goalTarget", String(Number(goal?.targetValue || 1)));
  setInputValue("goalUnit", String(goal?.unit || "lần").trim() || "lần");
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(goal?.dueDate || ""))) {
    setInputValue("goalDueDate", String(goal?.dueDate || ""));
  }
  setInputValue("goalPriority", String(goal?.priority || "medium"));
  setInputValue("goalNote", String(goal?.note || "").trim());

  setInputValue("habitName", String(habit?.name || "").trim());
  setInputValue("habitPeriod", String(habit?.period || "day"));
  setInputValue("habitTarget", String(Number(habit?.targetCount || 1)));
  setInputValue("habitXp", String(Number(habit?.xpPerCheckin || 10)));
}

async function handleGoalAiAction(mode = "generate") {
  const uid = ensureUser();
  if (!uid) return;
  if (state.goalAi.loading) return;

  const cooldownSec = getCooldownSeconds(state.goalAi.cooldownUntil);
  if (cooldownSec > 0) {
    showToast(
      formatTemplate(t("ai.common.cooldownToast", "Vui lòng chờ {{sec}} giây trước khi gọi AI tiếp theo."), {
        sec: cooldownSec,
      }),
      "info"
    );
    return;
  }

  state.goalAi.loading = true;
  state.goalAi.mode = mode === "improve" ? "improve" : "generate";
  setGoalAiButtonsState();
  try {
    const inputSnapshot = readGoalContextInput();
    state.goalAi.inputSnapshot = inputSnapshot;
    const res = await getGoalSuggestions(
      {
        mode: state.goalAi.mode,
        input: inputSnapshot,
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );

    state.goalAi.options = Array.isArray(res?.options) ? res.options.slice(0, 3) : [];
    renderGoalAiSuggestions();
    showToast(t("toast.goalAiReady", "AI đã tạo 3 bundle mục tiêu."), "success");
  } catch (err) {
    console.error("handleGoalAiAction error", err);
    state.goalAi.options = [];
    renderGoalAiSuggestions();
    showToast(
      err?.message || t("toast.goalAiFail", "Không thể tạo gợi ý mục tiêu lúc này."),
      "error"
    );
  } finally {
    state.goalAi.loading = false;
    state.goalAi.cooldownUntil = Date.now() + AI_COOLDOWN_MS;
    setGoalAiButtonsState();
    scheduleAiCooldownUiTick();
  }
}

function bindDashboardEvents() {
  if (bindState.dashboard) return;
  bindState.dashboard = true;

  initDashboardEvents({
    onHabitCheckIn: async (habitId) => {
      try {
        await handleHabitCheckInAction(habitId);
      } catch (err) {
        console.error("dashboard check-in error", err);
        showToast(err?.message || t("toast.habitUpdateFail", "Không thể cập nhật thói quen"), "error");
      }
    },
    onOpenVideoPlan: (taskId) => {
      if (taskId) {
        window.dispatchEvent(new CustomEvent("nexus:video-focus", { detail: { taskId } }));
      }
      if (location.hash !== "#video-plan") {
        location.hash = "#video-plan";
      }
    },
  });

  window.addEventListener("nexus:balances-updated", (event) => {
    const balances = Array.isArray(event?.detail) ? event.detail : [];
    state.accountBalances = balances;
    renderDashboardCenter();
  });
}

async function handleWeeklyReviewSaveAction(planInput = {}) {
  const uid = ensureUser();
  if (!uid) return;

  try {
    const normalizedPlan = parseWeeklyPlanInput(planInput);
    const baseVm = state.weeklyReviewVm || (await buildWeeklyReviewVM(uid, "", weeklyReviewOptions()));
    state.weeklyReviewVm = baseVm;

    setWeeklyReviewSaveState({ status: "saving" });
    const savedPlan = await saveWeeklyReviewPlan(uid, baseVm, normalizedPlan);

    state.weeklyReviewVm = {
      ...baseVm,
      plan: savedPlan,
    };

    setWeeklyReviewSaveState({
      status: "saved",
      savedAt: new Date(),
    });
    showToast(t("toast.weeklyReviewSaved", "Đã lưu tổng kết tuần."), "success");

    await loadWeeklyReview(uid, baseVm.weekKey);
  } catch (err) {
    console.error("save weekly review error", err);
    setWeeklyReviewSaveState({ status: "error" });
    showToast(
      err?.message || t("toast.weeklyReviewSaveFail", "Không thể lưu tổng kết tuần."),
      "error"
    );
  }
}

function bindWeeklyReviewModule() {
  if (bindState.weeklyReview) return;
  bindState.weeklyReview = true;

  bindWeeklyReviewEvents({
    onSave: (planInput) => {
      void handleWeeklyReviewSaveAction(planInput);
    },
    onOpenHistory: (weekKey) => {
      const uid = ensureUser();
      if (!uid) return;
      void loadWeeklyReview(uid, weekKey);
    },
  });
}

function bindRouteSyncEvents() {
  if (bindState.routeSync) return;
  bindState.routeSync = true;

  window.addEventListener("hashchange", () => {
    const uid = state.currentUser?.uid;
    if (!uid) return;

    if (isWeeklyReviewRouteActive()) {
      resetWeeklyReviewSaveState();
      void loadWeeklyReview(uid, "");
    }
  });
}

function bindGoalEvents() {
  renderGoalAiSuggestions();
  setGoalAiButtonsState();

  byId("btnGoalAiGenerate")?.addEventListener("click", () => {
    void handleGoalAiAction("generate");
  });

  byId("btnGoalAiImprove")?.addEventListener("click", () => {
    void handleGoalAiAction("improve");
  });

  byId("goalAiSuggestionList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-goal-ai-apply");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (!Number.isFinite(index)) return;
    const option = state.goalAi.options[index];
    if (!option) return;

    applyGoalBundle(option);
    showToast(t("toast.goalAiApplied", "Đã áp dụng bundle AI vào form mục tiêu."), "success");
    await saveAppliedAiSuggestionSafe({
      type: "goal-bundle",
      mode: state.goalAi.mode || "generate",
      inputSnapshot: state.goalAi.inputSnapshot || {},
      appliedOutput: option,
      appliedAt: new Date(),
    });
  });

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
  renderVideoAiSuggestions();
  setVideoAiButtonsState();

  byId("btnVideoAiGenerate")?.addEventListener("click", () => {
    void handleVideoAiAction("generate");
  });

  byId("btnVideoAiImprove")?.addEventListener("click", () => {
    void handleVideoAiAction("improve");
  });

  byId("videoAiSuggestionList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-video-ai-apply");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (!Number.isFinite(index)) return;
    const option = state.videoAi.options[index];
    if (!option) return;

    applyVideoSuggestion(option);
    showToast(t("toast.videoAiApplied", "Đã áp dụng phương án AI vào form video."), "success");
    await saveAppliedAiSuggestionSafe({
      type: "video-copilot",
      mode: state.videoAi.mode || "generate",
      inputSnapshot: state.videoAi.inputSnapshot || {},
      appliedOutput: option,
      appliedAt: new Date(),
    });
  });

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

function initSettingsModule() {
  renderSettingsForm(state.settings, state.settingsSaveState);
  bindSettingsEvents({
    onPatch: (partialPatch, meta = {}) => {
      handleSettingsPatch(partialPatch, meta);
    },
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
bindWeeklyReviewModule();
bindRouteSyncEvents();
bindGoalEvents();
bindVideoEvents();
bindExportEvent();
initSettingsModule();
renderWeeklyReviewPage(null, state.weeklyReviewSaveState);

byId("btnConfirmDelete")?.addEventListener("click", handleConfirmDelete);

watchAuth(async (user) => {
  state.currentUser = user || null;
  updateUserMenuUI(user || null);

  if (!user) {
    setActiveRoute("auth");
    resetAppView();
    return;
  }

  try {
    await loadUserSettingsAndApply(user.uid);
  } catch (err) {
    console.error("loadUserSettingsAndApply error", err);
    state.settings = applySettingsToApp(state, createDefaultSettings());
    resetSettingsSave();
    applySettingsDerivedRuntime();
    renderSettingsForm(state.settings, state.settingsSaveState);
  }

  const nextRoute = resolvePostLoginRoute();
  setActiveRoute(nextRoute);
  await refreshAll(user.uid);
});
