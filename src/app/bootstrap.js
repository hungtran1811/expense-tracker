import { applyExpenseFiltersAndRender } from "../features/expenses/expenses.filters.js";
import { refreshExpensesFeature } from "../features/expenses/expenses.controller.js";
import { applyIncomeFiltersAndRender } from "../features/incomes/incomes.filters.js";
import { refreshIncomesFeature } from "../features/incomes/incomes.controller.js";
import {
  initAccountEvents,
} from "../features/accounts/accounts.controller.js";
import {
  loadAccountsRuntime,
  loadBalancesRuntime,
} from "../features/accounts/accounts.runtime.js";
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
  listAppliedAiSuggestions,
} from "../services/firebase/firestore.js";
import { exportCsvCurrentMonth } from "../features/export/exportCsv.js";
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
  loadWeeklyGoalsPlan,
  saveWeeklyGoalsPlan,
  getCurrentGoalsWeekKey,
} from "../features/goals/goals.controller.js";
import {
  renderGoalsTable,
  renderHabitsTable,
  renderGoalsSummary,
  renderGoalsDailyFocus,
} from "../features/goals/goals.ui.js";
import { getMotivationSummary } from "../features/motivation/motivation.controller.js";
import {
  renderMotivationDetails,
  buildDefaultMotivationSummary,
} from "../features/motivation/motivation.ui.js";
import {
  loadVideoTasks,
  createVideoTask,
  moveTaskToStage,
  removeVideoTask,
  updateVideoTaskDetails,
  buildVideoCalendarVM,
  loadVideoRetros,
  saveVideoRetro,
  loadContentBlueprints,
  saveContentBlueprint,
  ensureDefaultContentBlueprints,
  buildBlueprintPayloadFromSuggestion,
} from "../features/videoPlan/videoPlan.controller.js";
import {
  createDefaultVideoFilters,
  createDefaultVideoCalendarState,
  normalizeVideoCalendarState,
  loadVideoCalendarState,
  loadVideoFilters,
  saveVideoCalendarState,
  saveVideoFilters,
  hydrateVideoFilterControls,
  readVideoFiltersFromControls,
  filterVideoTasks,
  renderVideoFilterSummary,
  renderVideoBoard,
  renderVideoViewState,
  renderVideoCalendar,
  renderVideoSummary,
  VIDEO_STAGES,
} from "../features/videoPlan/videoPlan.ui.js";
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
import { t, formatTemplate } from "../shared/constants/copy.vi.js";
import {
  AUTH_BOOTSTRAP_TIMEOUT_MS,
  AUTH_WARM_HINT_KEY,
  LAST_ROUTE_KEY,
} from "../shared/constants/keys.js";
import { loadRouteModule, preloadRouteModule, loadAiServices } from "./moduleLoader.js";

const SETTINGS_DEBOUNCE_MS = 700;
const AI_REQUEST_TIMEOUT_MS = 15000;
const VIDEO_AI_COOLDOWN_MS = 2000;
const GOAL_AI_COOLDOWN_MS = 0;
const AI_EXPENSE_DEBOUNCE_MS = 600;
const AI_EXPENSE_AUTO_CONFIDENCE = 0.75;
const DEFAULT_EXPENSE_FILTERS = { category: "all", account: "all", search: "" };
const DEFAULT_INCOME_FILTERS = { account: "all", search: "" };
const CLASSES_LIST_TAB_KEY = "nexus_classes_list_tab_v1";
const CLASSES_MODE_KEY = "nexus_classes_mode_v1";
const CLASSES_PRESENTATION_CLASS_KEY = "nexus_classes_presentation_class_v1";
const APP_ROUTES = new Set([
  "dashboard",
  "expenses",
  "goals",
  "video-plan",
  "weekly-review",
  "accounts",
  "settings",
  "classes",
]);

function normalizeClassesListTab(value = "") {
  return String(value || "").trim() === "completed" ? "completed" : "active";
}

function loadClassesListTabState() {
  try {
    return normalizeClassesListTab(localStorage.getItem(CLASSES_LIST_TAB_KEY));
  } catch (err) {
    console.warn("Không thá»’ ?á»c tab l:p há»c", err);
    return "active";
  }
}

function persistClassesListTab(value = "") {
  const tab = normalizeClassesListTab(value);
  try {
    localStorage.setItem(CLASSES_LIST_TAB_KEY, tab);
  } catch (err) {
    console.warn("Không thá»’ lÆ°u tab l:p há»c", err);
  }
  return tab;
}

function normalizeClassesMode(value = "") {
  return String(value || "").trim() === "presentation" ? "presentation" : "admin";
}

function loadClassesModeState() {
  try {
    return normalizeClassesMode(localStorage.getItem(CLASSES_MODE_KEY));
  } catch (err) {
    console.warn("Không thể đọc chế độ lớp học", err);
    return "admin";
  }
}

function persistClassesMode(value = "") {
  const mode = normalizeClassesMode(value);
  try {
    localStorage.setItem(CLASSES_MODE_KEY, mode);
  } catch (err) {
    console.warn("Không thể lưu chế độ lớp học", err);
  }
  return mode;
}

function loadPresentationClassState() {
  try {
    return String(localStorage.getItem(CLASSES_PRESENTATION_CLASS_KEY) || "").trim();
  } catch (err) {
    console.warn("Không thể đọc lớp trình chiếu", err);
    return "";
  }
}

function persistPresentationClass(value = "") {
  const classId = String(value || "").trim();
  try {
    if (classId) {
      localStorage.setItem(CLASSES_PRESENTATION_CLASS_KEY, classId);
    } else {
      localStorage.removeItem(CLASSES_PRESENTATION_CLASS_KEY);
    }
  } catch (err) {
    console.warn("Không thể lưu lớp trình chiếu", err);
  }
  return classId;
}

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
  videoRetrosByTaskId: {},
  contentBlueprints: [],
  motivation: buildDefaultMotivationSummary(),
  videoFilters: createDefaultVideoFilters(),
  videoCalendar: loadVideoCalendarState(new Date()),
  videoCalendarVm: null,
  pendingVideoFocusTaskId: "",
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
  weeklyReviewFilter: {
    mode: "week",
    weekKey: "",
    monthKey: getCurrentYm(),
  },
  classes: [],
  classesMode: loadClassesModeState(),
  classesListTab: loadClassesListTabState(),
  classSelectedId: "",
  classPresentationId: loadPresentationClassState(),
  classStudents: [],
  classSessions: [],
  classSelectedSessionId: "",
  classRandomResult: null,
  classRandomHistory: [],
  weeklyGoals: {
    weekKey: "",
    plan: {
      focusTheme: "",
      topPriorities: [],
      actionCommitments: "",
      riskNote: "",
    },
    saveState: {
      status: "idle",
      savedAt: null,
    },
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
  videoAiHistory: {
    loadedAt: 0,
    usedTitles: [],
    recentIdeas: [],
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
  pendingDeleteClassId: null,
  aiTimer: null,
  aiCooldownUiTimer: null,
};

const bindState = {
  dashboard: false,
  video: false,
  weeklyReview: false,
  classes: false,
  routeSync: false,
};

let dashboardModule = null;
let weeklyReviewModule = null;
let classesModule = null;
let aiServicesModule = null;
let dashboardModulePromise = null;
let weeklyReviewModulePromise = null;
let classesModulePromise = null;

async function ensureDashboardModule() {
  if (dashboardModule) return dashboardModule;
  if (!dashboardModulePromise) {
    dashboardModulePromise = loadRouteModule("dashboard").then((mod) => {
      dashboardModule = mod || {};
      return dashboardModule;
    });
  }
  return dashboardModulePromise;
}

async function ensureWeeklyReviewModule() {
  if (weeklyReviewModule) return weeklyReviewModule;
  if (!weeklyReviewModulePromise) {
    weeklyReviewModulePromise = loadRouteModule("weekly-review").then((mod) => {
      weeklyReviewModule = mod || {};
      return weeklyReviewModule;
    });
  }
  return weeklyReviewModulePromise;
}

async function ensureClassesModule() {
  if (classesModule) return classesModule;
  if (!classesModulePromise) {
    classesModulePromise = loadRouteModule("classes").then((mod) => {
      classesModule = mod || {};
      return classesModule;
    });
  }
  return classesModulePromise;
}

async function ensureAiServicesModule() {
  if (!aiServicesModule) {
    aiServicesModule = await loadAiServices();
  }
  return aiServicesModule;
}

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

function normalizeAppRoute(routeId = "", { allowAuth = false } = {}) {
  const route = String(routeId || "").trim();
  if (!route) return "";
  if (route === "auth") return allowAuth ? "auth" : "";
  return APP_ROUTES.has(route) ? route : "";
}

function readStorageSafe(key = "") {
  try {
    return String(localStorage.getItem(String(key || "")) || "").trim();
  } catch {
    return "";
  }
}

function getStoredLastRoute() {
  return normalizeAppRoute(readStorageSafe(LAST_ROUTE_KEY));
}

function hasAuthWarmHint() {
  return readStorageSafe(AUTH_WARM_HINT_KEY) === "1";
}

function isRouteActive(routeId) {
  return currentRouteId() === String(routeId || "").trim();
}

function isWeeklyReviewRouteActive() {
  return isRouteActive("weekly-review");
}

function isVideoPlanRouteActive() {
  return isRouteActive("video-plan");
}

function isClassesRouteActive() {
  return isRouteActive("classes");
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

function normalizeWeeklyReviewMode(value = "") {
  return String(value || "").trim() === "month" ? "month" : "week";
}

function isValidWeekKey(value = "") {
  return /^\d{4}-W\d{2}$/.test(String(value || "").trim());
}

function getCurrentWeekKeyForReview() {
  if (typeof weeklyReviewModule?.getCurrentWeekKey === "function") {
    return String(weeklyReviewModule.getCurrentWeekKey(new Date()) || "").trim();
  }
  const now = new Date();
  const temp = new Date(now);
  temp.setHours(0, 0, 0, 0);
  const day = (temp.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - day + 3);
  const firstThursday = new Date(temp.getFullYear(), 0, 4);
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);
  const weekNo = 1 + Math.round((temp.getTime() - firstThursday.getTime()) / 604800000);
  return `${temp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function ymToDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [y, m] = raw.split("-").map((part) => Number(part));
  const date = new Date(y, m - 1, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return getCurrentYm();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYm(value, delta = 0) {
  const base = ymToDate(value) || new Date();
  const shifted = new Date(base.getFullYear(), base.getMonth() + Number(delta || 0), 1);
  return toYmFromDate(shifted);
}

function mergeVideoCalendarState(patch = {}, { persist = true } = {}) {
  const merged = normalizeVideoCalendarState(
    {
      ...(state.videoCalendar || createDefaultVideoCalendarState(new Date())),
      ...(patch || {}),
    },
    new Date()
  );
  const prev = state.videoCalendar || {};
  const changed =
    prev.viewMode !== merged.viewMode ||
    prev.selectedDate !== merged.selectedDate ||
    prev.monthAnchor !== merged.monthAnchor;
  state.videoCalendar = merged;
  if (persist && changed) {
    saveVideoCalendarState(merged);
  }
  return merged;
}

function setVideoPlanViewMode(viewMode = "board", { persist = true } = {}) {
  const nextMode = viewMode === "calendar" ? "calendar" : "board";
  mergeVideoCalendarState({ viewMode: nextMode }, { persist });
  renderVideoViewState(nextMode);
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
  const hashRoute = normalizeAppRoute(currentHashRouteId());
  if (hashRoute) return hashRoute;

  const lastRoute = getStoredLastRoute();
  if (lastRoute) return lastRoute;

  const settingsRoute = normalizeAppRoute(getDashboardPrefs().startRoute);
  if (settingsRoute) return settingsRoute;

  return "dashboard";
}

function resolveWarmStartRoute() {
  const hashRoute = normalizeAppRoute(currentHashRouteId());
  if (hashRoute) return hashRoute;

  const lastRoute = getStoredLastRoute();
  if (lastRoute) return lastRoute;

  return "dashboard";
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
  const nextMonth = getCurrentYm();
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

function setSettingsSaveState(next = {}) {
  state.settingsSaveState = {
    ...state.settingsSaveState,
    ...next,
  };
  renderSettingsSaveState(state.settingsSaveState);
}

function formatGoalsSaveStatus(saveState = {}) {
  const status = String(saveState?.status || "idle");
  if (status === "saving") return t("goals.weekly.saving", "Đang lưu kế hoạch tuần...");
  if (status === "saved") {
    const savedAt = saveState?.savedAt instanceof Date ? saveState.savedAt : null;
    if (savedAt && !Number.isNaN(savedAt.getTime())) {
      return formatTemplate(t("goals.weekly.savedAt", "Đã lưu lúc {{time}}"), {
        time: savedAt.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
    return t("goals.weekly.saved", "Đã lưu kế hoạch tuần");
  }
  if (status === "error") return t("goals.weekly.error", "Lưu mục tiêu tuần thất bại");
  return t("goals.weekly.ready", "Sẵn sàng cập nhật mục tiêu tuần");
}

function formatWeekLabel(weekKey = "") {
  const key = String(weekKey || "").trim();
  if (!key) return t("goals.weekly.currentWeek", "Tuần hiện tại");
  return formatTemplate(t("goals.weekly.label", "Kế hoạch tuần {{weekKey}}"), {
    weekKey: key,
  });
}

function getGoalsTopPriorityAt(index = 0) {
  const list = Array.isArray(state.weeklyGoals?.plan?.topPriorities) ? state.weeklyGoals.plan.topPriorities : [];
  return String(list[index] || "").trim();
}

function renderWeeklyGoalsPanel() {
  const weekLabel = byId("goalsWeekLabel");
  if (weekLabel) weekLabel.textContent = formatWeekLabel(state.weeklyGoals?.weekKey || "");
  setInputValue("weeklyFocusTheme", state.weeklyGoals?.plan?.focusTheme || "");
  setInputValue("weeklyGoal1", getGoalsTopPriorityAt(0));
  setInputValue("weeklyGoal2", getGoalsTopPriorityAt(1));
  setInputValue("weeklyGoal3", getGoalsTopPriorityAt(2));
  setInputValue("weeklyActionPlan", state.weeklyGoals?.plan?.actionCommitments || "");
  const weeklyStatus = byId("goalsWeeklyStatus");
  if (weeklyStatus) weeklyStatus.textContent = formatGoalsSaveStatus(state.weeklyGoals?.saveState || {});
}

function readWeeklyGoalsFormInput() {
  return {
    focusTheme: (byId("weeklyFocusTheme")?.value || "").trim(),
    topPriorities: [
      (byId("weeklyGoal1")?.value || "").trim(),
      (byId("weeklyGoal2")?.value || "").trim(),
      (byId("weeklyGoal3")?.value || "").trim(),
    ].filter(Boolean),
    actionCommitments: (byId("weeklyActionPlan")?.value || "").trim(),
  };
}

function setWeeklyGoalsSaveState(next = {}) {
  state.weeklyGoals = {
    ...state.weeklyGoals,
    saveState: {
      ...state.weeklyGoals.saveState,
      ...next,
    },
  };
  const weeklyStatus = byId("goalsWeeklyStatus");
  if (weeklyStatus) {
    weeklyStatus.textContent = formatGoalsSaveStatus(state.weeklyGoals?.saveState || {});
  }
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
  // Không lưu lại tháng cũ theo yêu cầu: luôn ưu tiên tháng hiện tại.
  void immediate;
  void silent;
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
    if (partialPatch?.preferences?.dashboard) {
      renderVideoBoardWithFilters();
    }
    renderDashboardCenter();
    if (state.currentUser?.uid && isWeeklyReviewRouteActive()) {
      const mode = normalizeWeeklyReviewMode(state.weeklyReviewFilter?.mode || "week");
      const periodKey =
        mode === "month"
          ? String(state.weeklyReviewFilter?.monthKey || getCurrentYm()).trim()
          : String(state.weeklyReviewFilter?.weekKey || "").trim();
      void loadWeeklyReview(state.currentUser.uid, periodKey, { mode });
    }
  }
}

function localizeStaticVietnamese() {
  document.documentElement.lang = "vi";
  document.title = t("brand.name", "NEXUS OS");
  const setText = (id, path, fallback) => {
    const el = byId(id);
    if (el) el.textContent = t(path, fallback);
  };

  setText("videoPlanTitle", "videoPlan.layout.pageTitle", "Kế hoạch video");
  setText("videoPlanSubtitle", "videoPlan.layout.pageSubtitle", "Quản lý kế hoạch video theo giai đoạn.");
  setText("videoCreateTitle", "videoPlan.layout.createTitle", "Tạo nhanh công việc video");
  setText("videoCreateSubtitle", "videoPlan.layout.createSubtitle", "Điền thông tin cốt lõi và hoàn thiện nội dung.");
  setText("videoFilterTitle", "videoPlan.layout.filtersTitle", "Bộ lọc và điều hướng");
  setText("videoFilterSubtitle", "videoPlan.layout.filtersSubtitle", "Lọc theo giai đoạn, ưu tiên, trạng thái và từ khóa.");
  setText("videoViewModeLabel", "videoPlan.layout.viewModeLabel", "Chế độ hiển thị");
  setText("videoCalendarAgendaTitle", "videoPlan.layout.agendaTitle", "Lịch theo ngày");
  setText("videoCalendarUnscheduledTitle", "videoPlan.layout.unscheduledTitle", "Chưa lên lịch");
  setText("videoCalendarOpenBoardLink", "videoPlan.layout.openBoard", "Mở bảng video");

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
  setText("classesPageTitle", "classes.title", "Quản lý lớp học");
  setText(
    "classesPageSubtitle",
    "classes.subtitle",
    "Theo dõi lịch 14 buổi, học sinh và ghi chú từng buổi trong một màn hình."
  );
  setText("classesListTitle", "classes.listTitle", "Danh sách lớp");
  setText("classesDetailTitle", "classes.detailTitle", "Chi tiết lớp");
  setText("classesStudentsTitle", "classes.studentsTitle", "Học sinh");
  setText("classesSessionsTitle", "classes.sessionsTitle", "Lịch 14 buổi");
  setText("classesSessionEditorTitle", "classes.sessionEditorTitle", "Ghi chú buổi học");
  setText("classesReviewTableTitle", "classes.reviewTableTitle", "Nhận xét từng học sinh");
  setText("dashClassTitle", "dashboard.classes.title", "Buổi học sắp tới");

  updateNavbarStats(state.expTotal, state.incTotal);
  document.documentElement.setAttribute("data-i18n-ready", "true");
}

function ensureUser() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    showToast(t("toast.signInRequired", "Vui lòng ?Ä’ng nháº­p trÆ°:c"), "error");
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
    t("ai.expenseLabel.suggested", "AI ?á» xuáº¥t danh má»¥c {{category}} (? tin cáº­y {{confidence}})."),
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
      t("ai.expenseLabel.autoApplied", "AI ?ã tá»± gán danh má»¥c {{category}} ({{confidence}})."),
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
      t("ai.expenseLabel.manualApplied", "Äã áp dá»¥ng danh má»¥c {{category}} tá»« gá»£i ý AI."),
      {
        category,
      }
    );
    hint.classList.add("ai-inline-hint-success");
    applyBtn.classList.add("d-none");
    applyBtn.disabled = true;
  } else if (mode === "error") {
    text = t("ai.expenseLabel.errorHint", "ChÆ°a thá»’ gá»£i ý danh má»¥c lúc này. Báº¡n váº«n có thá»’ chá»n thá»§ công.");
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
  if (!dashboardModule) {
    void ensureDashboardModule().then(() => {
      renderDashboardCenter();
    });
    return;
  }

  const vm = dashboardModule.buildDashboardCommandCenterVM(state, new Date());
  dashboardModule.renderDashboardCommandCenter(vm);
  dashboardModule.renderDashboardActionBoard(vm?.actionBoard || {});
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

async function loadGoals(uid) {
  const weekKey = getCurrentGoalsWeekKey();
  const [{ goals, habits, todayLogs, habitProgress }, weeklyGoals] = await Promise.all([
    loadGoalsData(uid),
    loadWeeklyGoalsPlan(uid, weekKey),
  ]);

  state.goals = Array.isArray(goals) ? goals : [];
  state.habits = Array.isArray(habits) ? habits : [];
  state.todayHabitLogs = Array.isArray(todayLogs) ? todayLogs : [];
  state.habitProgress = habitProgress && typeof habitProgress === "object" ? habitProgress : {};
  state.weeklyGoals = {
    ...state.weeklyGoals,
    weekKey: String(weeklyGoals?.weekKey || weekKey || "").trim(),
    plan: {
      focusTheme: String(weeklyGoals?.plan?.focusTheme || "").trim(),
      topPriorities: Array.isArray(weeklyGoals?.plan?.topPriorities) ? weeklyGoals.plan.topPriorities : [],
      actionCommitments: String(weeklyGoals?.plan?.actionCommitments || "").trim(),
      riskNote: String(weeklyGoals?.plan?.riskNote || "").trim(),
    },
  };

  renderGoalsTable(byId("goalsTableBody"), state.goals);
  renderHabitsTable(byId("habitsTableBody"), state.habits, state.habitProgress);
  renderGoalsDailyFocus(byId("goalsDailyFocus"), state.habits, state.habitProgress);
  renderWeeklyGoalsPanel();
  renderGoalsSummary(byId("dashboardGoalsSummary"), state.goals);
  renderDashboardCenter();
}

async function loadMotivation(uid) {
  const summary = await getMotivationSummary(uid);
  state.motivation = summary || buildDefaultMotivationSummary();

  renderMotivationDetails(state.motivation);
  renderDashboardCenter();
}

async function renderClassesPage() {
  const module = await ensureClassesModule();
  if (!module?.buildClassesPageVM || !module?.renderClassesPage) return;

  const vm = module.buildClassesPageVM({
    classes: state.classes,
    mode: state.classesMode,
    listTab: state.classesListTab,
    selectedClassId: state.classSelectedId,
    presentationClassId: state.classPresentationId,
    students: state.classStudents,
    sessions: state.classSessions,
    selectedSessionId: state.classSelectedSessionId,
    classRandomResult: state.classRandomResult,
    classRandomHistory: state.classRandomHistory,
  });

  state.classesMode = normalizeClassesMode(vm?.mode || state.classesMode);
  state.classesListTab = normalizeClassesListTab(vm?.listTab || state.classesListTab);
  state.classSelectedId = String(vm?.selectedClass?.id || "").trim();
  state.classPresentationId = persistPresentationClass(String(vm?.presentation?.selectedClass?.id || ""));
  state.classSelectedSessionId = String(vm?.selectedSessionId || "").trim();
  module.renderClassesPage(vm);
}

function classesInCurrentTab(classes = state.classes, listTab = state.classesListTab) {
  const tab = normalizeClassesListTab(listTab);
  if (tab === "completed") {
    return (Array.isArray(classes) ? classes : []).filter(
      (item) => String(item?.status || "").trim() === "completed"
    );
  }
  return (Array.isArray(classes) ? classes : []).filter(
    (item) => String(item?.status || "active").trim() === "active"
  );
}

function classesInCurrentMode(classes = state.classes) {
  if (state.classesMode === "presentation") {
    return (Array.isArray(classes) ? classes : []).filter(
      (item) => String(item?.status || "active").trim() === "active"
    );
  }
  return classesInCurrentTab(classes, state.classesListTab);
}

function classExists(classId = "", classes = state.classes) {
  const id = String(classId || "").trim();
  return !!id && (Array.isArray(classes) ? classes : []).some((item) => String(item?.id || "") === id);
}

function resolveNextSessionNoForStudent() {
  const selectedClass = state.classes.find((item) => String(item?.id || "") === String(state.classSelectedId || ""));
  const classNext = Math.max(1, Number(selectedClass?.nextSessionNo || 1));
  const firstPlanned = state.classSessions.find((item) => String(item?.status || "planned") === "planned");
  const plannedNext = Math.max(1, Number(firstPlanned?.sessionNo || classNext || 1));
  return Math.max(classNext, plannedNext);
}

function normalizePickPercentInput(value = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

async function loadClasses(uid, options = {}) {
  if (!uid) return;

  const module = await ensureClassesModule();
  if (!module?.loadClassesOverview || !module?.loadClassDetail) return;

  if (options?.listTab) {
    state.classesListTab = persistClassesListTab(options.listTab);
  }

  const classes = await module.loadClassesOverview(uid, {});
  state.classes = Array.isArray(classes) ? classes : [];
  const scopedClasses = classesInCurrentMode(state.classes);

  const forceClassId = String(options?.forceClassId || "").trim();
  const preserveSelection = options?.preserveSelection !== false;
  const previousSessionId = preserveSelection ? String(state.classSelectedSessionId || "").trim() : "";
  const previousClassId = String(state.classSelectedId || "").trim();

  let selectedClassId = "";
  if (forceClassId) {
    selectedClassId = forceClassId;
  } else if (state.classesMode === "presentation") {
    selectedClassId = preserveSelection
      ? String(state.classPresentationId || state.classSelectedId || "").trim()
      : String(state.classPresentationId || "").trim();
  } else {
    selectedClassId = preserveSelection ? String(state.classSelectedId || "").trim() : "";
  }

  if (!selectedClassId && scopedClasses.length) {
    selectedClassId = String(scopedClasses[0]?.id || "").trim();
  }
  if (selectedClassId && !classExists(selectedClassId, scopedClasses)) {
    selectedClassId = String(scopedClasses[0]?.id || "").trim();
  }

  state.classSelectedId = selectedClassId;
  if (state.classesMode === "presentation") {
    state.classPresentationId = persistPresentationClass(selectedClassId);
  }
  state.classStudents = [];
  state.classSessions = [];
  state.classSelectedSessionId = "";
  if (!preserveSelection || selectedClassId !== previousClassId) {
    state.classRandomResult = null;
    state.classRandomHistory = [];
  }

  if (selectedClassId) {
    const detail = await module.loadClassDetail(uid, selectedClassId, { ensureSessions: true });
    if (detail?.classItem?.id) {
      state.classes = state.classes.map((item) =>
        String(item?.id || "") === String(detail.classItem.id) ? detail.classItem : item
      );
    }
    state.classStudents = Array.isArray(detail?.students) ? detail.students : [];
    state.classSessions = Array.isArray(detail?.sessions) ? detail.sessions : [];
    state.classSelectedSessionId = previousSessionId;
  }

  await renderClassesPage();
  renderDashboardCenter();
}

function getFilteredVideoTasks() {
  const tasksWithRetro = (Array.isArray(state.videoTasks) ? state.videoTasks : []).map((task) => ({
    ...task,
    hasRetro: !!state.videoRetrosByTaskId?.[task.id],
  }));
  return filterVideoTasks(tasksWithRetro, state.videoFilters);
}

function renderVideoCalendarWithTasks(tasks = []) {
  const calendarState = mergeVideoCalendarState({}, { persist: false });
  const deadlineWindowHours = Number(getDashboardPrefs()?.deadlineWindowHours || 72);
  const vm = buildVideoCalendarVM(tasks, calendarState.selectedDate, new Date(), {
    monthAnchor: calendarState.monthAnchor,
    deadlineWindowHours,
  });

  state.videoCalendarVm = vm;
  mergeVideoCalendarState(
    {
      selectedDate: vm?.selectedDateKey || calendarState.selectedDate,
      monthAnchor: vm?.monthAnchor || calendarState.monthAnchor,
    },
    { persist: false }
  );
  renderVideoCalendar(vm);
}

function renderVideoBoardWithFilters() {
  const filteredTasks = getFilteredVideoTasks();
  renderVideoBoard(filteredTasks);
  renderVideoFilterSummary(byId("videoFilterSummary"), filteredTasks.length, state.videoTasks.length);
  renderVideoCalendarWithTasks(filteredTasks);
  renderVideoViewState(state.videoCalendar?.viewMode || "board");
}

function syncVideoFilterControls() {
  hydrateVideoFilterControls(state.videoFilters);
}

const VIDEO_TRACKS = [
  "python",
  "javascript",
  "frontend",
  "backend",
  "data_ai",
  "automation",
  "mobile",
  "system_design",
];

const VIDEO_TRACK_TO_BLUEPRINT_LANGUAGE = {
  python: "python",
  javascript: "javascript",
  frontend: "javascript",
  backend: "javascript",
  data_ai: "python",
  automation: "python",
  mobile: "javascript",
  system_design: "javascript",
};

const VIDEO_TRACK_LABEL = {
  python: "Python",
  javascript: "JavaScript",
  frontend: "Frontend thá»±c chiáº¿n",
  backend: "Backend thá»±c chiáº¿n",
  data_ai: "Data/AI á»©ng dá»¥ng",
  automation: "Tá»± ?ng hóa thá»±c táº¿",
  mobile: "Mobile app cÆ¡ báº£n",
  system_design: "System design nháº­p môn",
};

const VIDEO_TRACK_TOPICS = {
  python: ["Project Python cÆ¡ báº£n", "TÆ° duy giáº£i bài toán tá»«ng bÆ°:c", "Debug cho ngÆ°á»i m:i"],
  javascript: ["Project JavaScript thuáº§n", "DOM và event thá»±c chiáº¿n", "Mini app cháº¡y ?Æ°á»£c ngay"],
  frontend: ["UI/UX cho ngÆ°á»i m:i", "Responsive thá»±c táº¿", "T?i Æ°u tráº£i nghi!m ngÆ°á»i dùng"],
  backend: ["Xây API tá»« ?áº§u", "Auth và báº£o máº­t cÆ¡ báº£n", "Database cho dá»± án nhá»"],
  data_ai: ["Phân tích dá»¯ li!u d& hiá»’u", "á»¨ng dá»¥ng AI vào bài toán tháº­t", "Mini project v:i model có sáºµn"],
  automation: ["Tá»± ?ng hóa tác vá»¥ láº·p láº¡i", "Script tiáº¿t ki!m thá»i gian", "Workflow cá nhân hóa"],
  mobile: ["Mini app mobile cho ngÆ°á»i m:i", "Navigation và state cÆ¡ báº£n", "T?i Æ°u tráº£i nghi!m trên ?i!n thoáº¡i"],
  system_design: ["Thiáº¿t káº¿ h! th?ng nháº­p môn", "Scalability cÆ¡ báº£n", "TÆ° duy kiáº¿n trúc qua ví dá»¥ ?Æ¡n giáº£n"],
};

const VIDEO_TRACK_KEYWORDS = {
  python: ["python", "pandas", "django", "fastapi", "flask"],
  javascript: ["javascript", "js", "node", "react", "vue"],
  frontend: ["frontend", "ui", "ux", "css", "html"],
  backend: ["backend", "api", "server", "database", "auth"],
  data_ai: ["ai", "data", "machine learning", "llm", "pandas", "numpy"],
  automation: ["automation", "tá»± ?ng", "workflow", "script", "bot"],
  mobile: ["mobile", "android", "ios", "react native", "flutter"],
  system_design: ["system design", "kiáº¿n trúc", "scalability", "cache", "queue"],
};

function normalizeVideoTrack(value = "", fallback = "python") {
  const selected = String(value || "").trim().toLowerCase();
  if (VIDEO_TRACKS.includes(selected)) return selected;
  return VIDEO_TRACKS.includes(fallback) ? fallback : "python";
}

function getSelectedVideoTrack() {
  return normalizeVideoTrack(byId("videoAiLanguage")?.value || "", "python");
}

function getSelectedVideoLanguage() {
  return getSelectedVideoTrack();
}

function getBlueprintLanguageByTrack(track = "python") {
  const safeTrack = normalizeVideoTrack(track, "python");
  return VIDEO_TRACK_TO_BLUEPRINT_LANGUAGE[safeTrack] || "python";
}

function getSelectedBlueprintLanguage() {
  return getBlueprintLanguageByTrack(getSelectedVideoTrack());
}

function getSelectedVideoType() {
  const selected = String(byId("videoBlueprintType")?.value || byId("videoType")?.value || "")
    .trim()
    .toLowerCase();
  return selected === "long" ? "long" : "short";
}

function getFilteredBlueprints() {
  const language = getSelectedBlueprintLanguage();
  const videoType = getSelectedVideoType();
  return (Array.isArray(state.contentBlueprints) ? state.contentBlueprints : []).filter(
    (item) =>
      String(item?.language || "").toLowerCase() === language &&
      String(item?.videoType || "").toLowerCase() === videoType &&
      item?.active !== false
  );
}

function syncVideoBlueprintControls() {
  const select = byId("videoBlueprintSelect");
  if (!select) return;

  const currentValue = String(select.value || "").trim();
  const filtered = getFilteredBlueprints();
  const optionsHtml = filtered.length
    ? filtered
        .map((item) => {
          const id = String(item?.id || "").trim();
          const name = escapeHtml(String(item?.name || "").trim() || t("videoPlan.blueprints.fallbackName", "Máº«u ni dung AI"));
          return `<option value="${escapeHtml(id)}">${name}</option>`;
        })
        .join("")
    : `<option value="">${escapeHtml(t("videoPlan.blueprints.noData", "ChÆ°a có template phù há»£p. Hãy táº¡o tá»« AI gá»£i ý ?áº§u tiên."))}</option>`;

  select.innerHTML = `<option value="">${escapeHtml(
    t("videoPlan.blueprints.placeholder", "Chá»n máº«u ni dung")
  )}</option>${optionsHtml}`;

  if (filtered.some((item) => String(item?.id || "") === currentValue)) {
    select.value = currentValue;
  } else {
    select.value = "";
  }
}

function escapeSelector(value = "") {
  const raw = String(value || "");
  if (window.CSS?.escape) return window.CSS.escape(raw);
  return raw.replace(/["\\]/g, "\\$&");
}

function focusVideoTaskCard(taskId = "") {
  const id = String(taskId || "").trim();
  if (!id) return false;

  const card = document.querySelector(`.video-card[data-id="${escapeSelector(id)}"]`);
  if (!card) return false;

  card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  card.classList.add("video-card-focus");
  setTimeout(() => {
    card.classList.remove("video-card-focus");
  }, 1400);
  return true;
}

function focusPendingVideoTask() {
  const taskId = String(state.pendingVideoFocusTaskId || "").trim();
  if (!taskId) return false;

  setVideoPlanViewMode("board", { persist: true });
  renderVideoBoardWithFilters();
  let found = focusVideoTaskCard(taskId);
  if (!found) {
    state.videoFilters = createDefaultVideoFilters();
    syncVideoFilterControls();
    saveVideoFilters(state.videoFilters);
    persistRememberedFilterState("videoState", state.videoFilters);
    renderVideoBoardWithFilters();
    found = focusVideoTaskCard(taskId);
  }
  state.pendingVideoFocusTaskId = "";
  return found;
}

function handleVideoFocusRequest(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return;
  state.pendingVideoFocusTaskId = id;

  if (!isVideoPlanRouteActive()) return;
  focusPendingVideoTask();
}

async function loadVideo(uid) {
  const tasks = await loadVideoTasks(uid);
  state.videoTasks = Array.isArray(tasks) ? tasks : [];

  const [retros, blueprints] = await Promise.all([
    loadVideoRetros(
      uid,
      state.videoTasks.map((task) => task.id)
    ),
    ensureDefaultContentBlueprints(uid),
  ]);

  state.videoRetrosByTaskId = (Array.isArray(retros) ? retros : []).reduce((acc, item) => {
    const id = String(item?.taskId || item?.id || "").trim();
    if (id) acc[id] = item;
    return acc;
  }, {});
  state.contentBlueprints = Array.isArray(blueprints) ? blueprints : [];

  mergeVideoCalendarState(loadVideoCalendarState(new Date()), { persist: false });
  syncVideoFilterControls();
  syncVideoBlueprintControls();
  renderVideoBoardWithFilters();
  renderVideoSummary(byId("dashboardVideoSummary"), state.videoTasks);
  focusPendingVideoTask();
  renderDashboardCenter();
}

function weeklyReviewOptions() {
  const dashboardPrefs = getDashboardPrefs();
  return {
    deadlineWindowHours: Number(dashboardPrefs?.deadlineWindowHours || 72),
    historyLimit: 12,
  };
}

async function loadWeeklyReview(uid, periodKey = "", { mode = "" } = {}) {
  if (!uid) return;

  const module = await ensureWeeklyReviewModule();
  const safeMode = normalizeWeeklyReviewMode(mode || state.weeklyReviewFilter?.mode || "week");
  const fallbackWeek = getCurrentWeekKeyForReview();
  const fallbackMonth = getCurrentYm();
  const targetKey = String(periodKey || "").trim();
  const resolvedKey =
    safeMode === "month"
      ? (isValidYm(targetKey)
          ? targetKey
          : String(state.weeklyReviewFilter?.monthKey || fallbackMonth).trim())
      : (isValidWeekKey(targetKey)
          ? targetKey
          : String(state.weeklyReviewFilter?.weekKey || state.weeklyReviewVm?.weekKey || fallbackWeek).trim());

  const vm = await module.buildWeeklyReviewVM(uid, resolvedKey, {
    ...weeklyReviewOptions(),
    periodMode: safeMode,
  });
  state.weeklyReviewVm = vm;
  state.weeklyReviewFilter = {
    mode: normalizeWeeklyReviewMode(vm?.period?.mode || safeMode),
    weekKey: String(vm?.period?.weekKey || fallbackWeek).trim(),
    monthKey: String(vm?.period?.monthKey || fallbackMonth).trim(),
  };
  module.renderWeeklyReviewPage(vm);
}

async function refreshWeeklyReviewIfVisible(uid) {
  if (!uid || !isWeeklyReviewRouteActive()) return;
  const mode = normalizeWeeklyReviewMode(state.weeklyReviewFilter?.mode || "week");
  const periodKey =
    mode === "month"
      ? String(state.weeklyReviewFilter?.monthKey || getCurrentYm()).trim()
      : String(state.weeklyReviewFilter?.weekKey || state.weeklyReviewVm?.weekKey || "").trim();
  await loadWeeklyReview(uid, periodKey, { mode });
}

async function refreshAll(uid) {
  if (!uid) return;

  setGlobalLoading(true);
  try {
    await Promise.all([
      loadAccountsRuntime(uid, state),
      loadFinance(uid),
      loadGoals(uid),
      loadVideo(uid),
      loadMotivation(uid),
      loadClasses(uid, { preserveSelection: true }),
      loadBalancesRuntime(uid, state, renderDashboardCenter),
    ]);
    await refreshWeeklyReviewIfVisible(uid);
  } catch (err) {
    console.error("refreshAll error", err);
    showToast(t("toast.loadFail", "Không thá»’ táº£i dá»¯ li!u. Vui lòng thá»­ láº¡i."), "error");
  } finally {
    setGlobalLoading(false);
  }
}

async function refreshAfterTransaction(uid) {
  if (!uid) return;
  await Promise.all([loadFinance(uid), loadBalancesRuntime(uid, state, renderDashboardCenter)]);
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
  state.videoRetrosByTaskId = {};
  state.contentBlueprints = [];
  state.weeklyReviewVm = null;
  state.weeklyReviewFilter = {
    mode: "week",
    weekKey: "",
    monthKey: getCurrentYm(),
  };
  state.classes = [];
  state.classesMode = loadClassesModeState();
  state.classSelectedId = "";
  state.classPresentationId = loadPresentationClassState();
  state.classStudents = [];
  state.classSessions = [];
  state.classSelectedSessionId = "";
  state.classRandomResult = null;
  state.classRandomHistory = [];
  state.weeklyGoals = {
    weekKey: "",
    plan: {
      focusTheme: "",
      topPriorities: [],
      actionCommitments: "",
      riskNote: "",
    },
    saveState: {
      status: "idle",
      savedAt: null,
    },
  };
  state.expenseAiSuggestion = null;
  state.expenseAiRequestId = 0;
  state.pendingVideoFocusTaskId = "";
  state.videoAi = {
    loading: false,
    cooldownUntil: 0,
    mode: "generate",
    options: [],
    inputSnapshot: null,
  };
  state.videoAiHistory = {
    loadedAt: 0,
    usedTitles: [],
    recentIdeas: [],
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
  state.videoCalendar = loadVideoCalendarState(new Date());
  state.videoCalendarVm = null;
  state.expenseFilters = { ...DEFAULT_EXPENSE_FILTERS };
  state.incomeFilters = { ...DEFAULT_INCOME_FILTERS };
  state.settings = applySettingsToApp(state, createDefaultSettings());
  state.motivation = buildDefaultMotivationSummary();
  state.expTotal = 0;
  state.incTotal = 0;
  state.pendingDeleteExpenseId = null;
  state.pendingDeleteIncomeId = null;
  state.pendingDeleteClassId = null;

  updateNavbarStats(0, 0);
  updateDashboardFinance({ expTotal: 0, incTotal: 0 });

  applyExpenseFiltersAndRender([], state.expenseFilters);
  applyIncomeFiltersAndRender([], state.incomeFilters);
  renderGoalsTable(byId("goalsTableBody"), []);
  renderHabitsTable(byId("habitsTableBody"), [], {});
  renderGoalsSummary(byId("dashboardGoalsSummary"), []);
  renderVideoBoard([]);
  renderVideoCalendarWithTasks([]);
  renderVideoViewState(state.videoCalendar?.viewMode || "board");
  renderVideoSummary(byId("dashboardVideoSummary"), []);
  renderVideoAiSuggestions();
  setVideoAiButtonsState();
  renderGoalAiSuggestions();
  setGoalAiButtonsState();
  renderWeeklyGoalsPanel();
  resetExpenseAiHint();
  renderMotivationDetails(state.motivation);
  if (weeklyReviewModule?.renderWeeklyReviewPage) {
    weeklyReviewModule.renderWeeklyReviewPage(null);
  }
  if (classesModule?.renderClassesPage && classesModule?.buildClassesPageVM) {
    const emptyVm = classesModule.buildClassesPageVM({
      classes: [],
      mode: state.classesMode,
      listTab: state.classesListTab,
      selectedClassId: "",
      presentationClassId: state.classPresentationId,
      students: [],
      sessions: [],
      selectedSessionId: "",
      classRandomResult: null,
      classRandomHistory: [],
    });
    classesModule.renderClassesPage(emptyVm);
  }

  const balance = byId("balanceList");
  if (balance) balance.innerHTML = '<div class="text-muted">ChÆ°a có dá»¯ li!u</div>';

  const dashboardBalance = byId("dashboardAccountBalances");
  if (dashboardBalance) dashboardBalance.innerHTML = '<div class="text-muted small">ChÆ°a có dá»¯ li!u</div>';

  resetSettingsSave();
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
  clearPendingDeleteState();
  if (type === "expense") state.pendingDeleteExpenseId = id;
  if (type === "income") state.pendingDeleteIncomeId = id;
  if (type === "class") state.pendingDeleteClassId = id;

  const title = byId("confirmDeleteTitle");
  const text = byId("confirmDeleteText");

  if (title) {
    if (type === "expense") {
      title.textContent = t("expenses.deleteTitle", "Xóa khoản chi?");
    } else if (type === "income") {
      title.textContent = t("incomes.deleteTitle", "Xóa khoản thu?");
    } else if (type === "class") {
      title.textContent = t("classes.confirmDeleteTitle", "Xóa lớp học?");
    } else {
      title.textContent = t("common.delete", "Xóa");
    }
  }

  if (text) {
    if (type === "class") {
      text.textContent = t("classes.confirmDelete", "Bạn chắc chắn muốn xóa lớp học này?");
    } else {
      text.textContent = t("common.deleteConfirmText", "Hành động này không thể hoàn tác.");
    }
  }

  bootstrap.Offcanvas.getOrCreateInstance(byId("confirmDeleteModal"))?.show();
}

function clearPendingDeleteState() {
  state.pendingDeleteExpenseId = null;
  state.pendingDeleteIncomeId = null;
  state.pendingDeleteClassId = null;
}

async function handleConfirmDeleteClass(uid, classId) {
  const module = await ensureClassesModule();
  if (!module?.deleteClassById) {
    throw new Error(t("toast.classDeleteFail", "Không thể xóa lớp học"));
  }

  await module.deleteClassById(uid, classId);
  showToast(t("toast.classDeleted", "Đã xóa lớp học."), "success");
  state.classSelectedId = "";
  state.classSelectedSessionId = "";
  await loadClasses(uid, { preserveSelection: false });
}

async function handleConfirmDelete() {
  const uid = ensureUser();
  if (!uid) return;

  try {
    let needRefreshTransactions = false;
    if (state.pendingDeleteExpenseId) {
      await deleteExpense(uid, state.pendingDeleteExpenseId);
      showToast(t("toast.expenseDeleted", "Äã xóa khoáº£n chi."), "success");
      needRefreshTransactions = true;
    } else if (state.pendingDeleteIncomeId) {
      await deleteIncome(uid, state.pendingDeleteIncomeId);
      showToast(t("toast.incomeDeleted", "Äã xóa khoáº£n thu."), "success");
      needRefreshTransactions = true;
    } else if (state.pendingDeleteClassId) {
      await handleConfirmDeleteClass(uid, state.pendingDeleteClassId);
    }

    bootstrap.Offcanvas.getOrCreateInstance(byId("confirmDeleteModal"))?.hide();
    clearPendingDeleteState();

    if (needRefreshTransactions) {
      await refreshAfterTransaction(uid);
    }
  } catch (err) {
    console.error("handleConfirmDelete error", err);
    showToast(err?.message || t("toast.deleteDataFail", "Không thá»’ xóa dá»¯ li!u"), "error");
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
    const ai = await ensureAiServicesModule();
    const data = await ai.suggestCategory({ name, note, categories, history });
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
      showToast(t("toast.expenseAdded", "Äã thêm khoáº£n chi."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("addExpense error", err);
      const errorBox = byId("aeError");
      if (errorBox) {
        errorBox.textContent = err?.message || "Không thá»’ thêm khoáº£n chi";
        errorBox.classList.remove("d-none");
      } else {
        showToast(err?.message || t("toast.expenseCreateFail", "Không thá»’ thêm khoáº£n chi"), "error");
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
      showToast(t("toast.expenseUpdated", "Äã cáº­p nháº­t khoáº£n chi."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("updateExpense error", err);
      showToast(err?.message || t("toast.expenseUpdateFail", "Không thá»’ cáº­p nháº­t khoáº£n chi"), "error");
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
        showToast(t("toast.expenseNotFound", "Không tìm tháº¥y khoáº£n chi"), "error");
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
      showToast(err?.message || t("toast.expenseOpenFail", "Không thá»’ mx khoáº£n chi"), "error");
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

      showToast(t("toast.incomeAdded", "Äã thêm khoáº£n thu."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("addIncome error", err);
      showToast(err?.message || t("toast.incomeCreateFail", "Không thá»’ thêm khoáº£n thu"), "error");
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
      showToast(t("toast.incomeUpdated", "Äã cáº­p nháº­t khoáº£n thu."), "success");
      await refreshAfterTransaction(uid);
    } catch (err) {
      console.error("updateIncome error", err);
      showToast(err?.message || t("toast.incomeUpdateFail", "Không thá»’ cáº­p nháº­t khoáº£n thu"), "error");
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
        showToast(t("toast.incomeNotFound", "Không tìm tháº¥y khoáº£n thu"), "error");
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
      showToast(err?.message || t("toast.incomeOpenFail", "Không thá»’ mx khoáº£n thu"), "error");
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

  let videoFilterTimer = null;
  const syncVideoFilters = () => {
    state.videoFilters = readVideoFiltersFromControls(state.videoFilters);
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
    persistRememberedFilterState("videoState", state.videoFilters);
  };

  byId("videoFilterStage")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterPriority")?.addEventListener("change", syncVideoFilters);
  byId("videoRetroFilter")?.addEventListener("change", syncVideoFilters);
  byId("videoFilterQuery")?.addEventListener("input", () => {
    if (videoFilterTimer) clearTimeout(videoFilterTimer);
    videoFilterTimer = setTimeout(() => {
      syncVideoFilters();
      videoFilterTimer = null;
    }, 220);
  });
  byId("btnVideoFilterReset")?.addEventListener("click", () => {
    if (videoFilterTimer) {
      clearTimeout(videoFilterTimer);
      videoFilterTimer = null;
    }
    state.videoFilters = createDefaultVideoFilters();
    syncVideoFilterControls();
    saveVideoFilters(state.videoFilters);
    renderVideoBoardWithFilters();
    persistRememberedFilterState("videoState", state.videoFilters);
    byId("videoFilterQuery")?.focus();
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
    showToast(t("toast.habitNotFound", "Không tìm tháº¥y thói quen"), "error");
    return;
  }

  const result = await checkInHabit(uid, habit);
  if (result?.status === "locked") {
    showToast(t("toast.habitLocked", "Báº¡n ?ã ?áº¡t má»¥c tiêu ká»³ này"), "info");
  } else {
    showToast(t("toast.habitChecked", "Äiá»’m danh thành công."), "success");
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
      "Bấm AI gợi ý để nhận phương án video có thể áp dụng ngay."
    )}</div>`;
    return;
  }

  root.innerHTML = options
    .map((item, index) => {
      const title = String(item?.title || "").trim() || t("ai.videoCopilot.optionUntitled", "Phương án chưa có tiêu đề");
      const hook = String(item?.hook || "").trim();
      const outline = String(item?.outline || "").trim();
      const shotList = String(item?.shotList || "").trim();
      const cta = String(item?.cta || "").trim();
      const note = String(item?.note || "").trim();
      const reason = String(item?.reason || "").trim();
      const priority = String(item?.priority || "medium").trim().toLowerCase();
      const priorityLabel = t(`videoPlan.priority.${priority}`, priority);
      const rawVideoType = String(item?.videoType || "long_5_10").trim().toLowerCase();
      const videoTypeLabel =
        rawVideoType === "short_30s"
          ? t("videoPlan.blueprints.short", "Video ngắn 30s")
          : t("videoPlan.blueprints.long", "Video dài 5-10 phút");
      const deadlineSuggestion = String(item?.deadlineSuggestion || "").trim();

      const safeTitle = escapeHtml(title);
      const safeReason = multilineToHtml(reason);
      const safeHook = multilineToHtml(hook);
      const safeOutline = multilineToHtml(outline);
      const safeShotList = multilineToHtml(shotList);
      const safeNote = multilineToHtml(note);
      const safeCta = multilineToHtml(cta);
      const safePriority = escapeHtml(priorityLabel);
      const safeVideoType = escapeHtml(videoTypeLabel);
      const safeDeadline = escapeHtml(deadlineSuggestion || t("ai.videoCopilot.noDeadline", "Không có hạn gợi ý"));

      return `
        <article class="ai-suggestion-card">
          <div class="ai-suggestion-index">${t("ai.videoCopilot.optionIndex", "Phương án {{index}}").replace(
            "{{index}}",
            String(index + 1)
          )}</div>
          <div class="ai-suggestion-card-head">
            <strong>${safeTitle}</strong>
            <span class="badge text-bg-light">${safePriority}</span>
          </div>
          <div class="small mt-1">${t("ai.videoCopilot.videoTypeLabel", "Định dạng video")}: ${safeVideoType}</div>
          <div class="small text-muted">${t("ai.videoCopilot.deadline", "Hạn gợi ý")}: ${safeDeadline}</div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.videoCopilot.hookLabel", "Hook mở đầu")}</div>
            <div class="ai-suggestion-content">${safeHook}</div>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.videoCopilot.outlineLabel", "Dàn ý triển khai")}</div>
            <div class="ai-suggestion-content">${safeOutline}</div>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.videoCopilot.shotListLabel", "Danh sách cảnh quay")}</div>
            <div class="ai-suggestion-content">${safeShotList}</div>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.videoCopilot.ctaLabel", "Kêu gọi hành động")}</div>
            <div class="ai-suggestion-content">${safeCta}</div>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.videoCopilot.noteLabel", "Ghi chú triển khai")}</div>
            <div class="ai-suggestion-content">${safeNote}</div>
          </div>
          ${reason ? `<div class="small mt-1 text-muted">${safeReason}</div>` : ""}
          <div class="d-flex flex-wrap gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary btn-video-ai-apply" data-index="${index}">
              ${t("ai.common.apply", "Áp dụng toàn bộ")}
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

function readVideoContextInput() {
  return {
    title: (byId("videoTitle")?.value || "").trim(),
    note: (byId("videoNote")?.value || "").trim(),
    shotList: (byId("videoShotList")?.value || "").trim(),
    assetLinks: (byId("videoAssetLinks")?.value || "").trim(),
    scriptUrl: (byId("videoScriptUrl")?.value || "").trim(),
    priority: byId("videoPriority")?.value || "medium",
    videoType: byId("videoType")?.value || "short",
    language: getSelectedVideoLanguage(),
  };
}

function rememberVideoAiAppliedTitle(title = "") {
  const value = String(title || "").trim();
  if (!value) return;
  const current = Array.isArray(state.videoAiHistory?.usedTitles) ? state.videoAiHistory.usedTitles : [];
  if (current.includes(value)) return;
  state.videoAiHistory.usedTitles = [value, ...current].slice(0, 60);
}

async function ensureVideoAiHistoryLoaded(uid) {
  const now = Date.now();
  if (now - Number(state.videoAiHistory?.loadedAt || 0) < 30000) return;

  try {
    const list = await listAppliedAiSuggestions(uid, { type: "video-copilot", limitCount: 40 });
    const titles = [];
    const recentIdeas = [];
    for (const item of Array.isArray(list) ? list : []) {
      const outputTitle = String(item?.appliedOutput?.title || "").trim();
      const inputTitle = String(item?.inputSnapshot?.title || "").trim();
      if (outputTitle) titles.push(outputTitle);
      if (inputTitle) recentIdeas.push(inputTitle);
    }

    const unique = (arr) => [...new Set(arr.filter(Boolean))];
    state.videoAiHistory = {
      loadedAt: now,
      usedTitles: unique([...(state.videoAiHistory?.usedTitles || []), ...titles]).slice(0, 60),
      recentIdeas: unique([...(state.videoAiHistory?.recentIdeas || []), ...recentIdeas]).slice(0, 60),
    };
  } catch (err) {
    console.warn("load video ai history fail", err);
    state.videoAiHistory.loadedAt = now;
  }
}

function applyVideoSuggestion(option = {}) {
  const title = String(option?.title || "").trim();
  const shotList = String(option?.shotList || "").trim();
  const assetLinks = String(option?.assetLinks || "").trim();
  const priority = String(option?.priority || "medium").trim().toLowerCase();
  const deadlineSuggestion = String(option?.deadlineSuggestion || "").trim();
  const rawType = String(option?.videoType || "").trim().toLowerCase();
  const mappedType = rawType === "short_30s" || rawType === "short" ? "short" : "long";

  const noteParts = [
    String(option?.hook || "").trim() ? `Hook:\n${String(option.hook).trim()}` : "",
    String(option?.outline || "").trim() ? `Dàn ý:\n${String(option.outline).trim()}` : "",
    String(option?.cta || "").trim() ? `CTA:\n${String(option.cta).trim()}` : "",
    String(option?.note || "").trim(),
  ].filter(Boolean);

  if (title) setInputValue("videoTitle", title);
  if (shotList) setInputValue("videoShotList", shotList);
  setInputValue("videoAssetLinks", assetLinks);
  setInputValue("videoPriority", ["low", "medium", "high"].includes(priority) ? priority : "medium");
  setInputValue("videoType", mappedType);
  setInputValue("videoBlueprintType", mappedType);
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineSuggestion)) {
    setInputValue("videoDeadline", deadlineSuggestion);
  }
  if (noteParts.length) {
    setInputValue("videoNote", noteParts.join("\n\n"));
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
    await ensureVideoAiHistoryLoaded(uid);
    const inputSnapshot = readVideoContextInput();
    state.videoAi.inputSnapshot = inputSnapshot;

    const ai = await ensureAiServicesModule();
    const res = await ai.getVideoCopilotSuggestions(
      {
        mode: state.videoAi.mode,
        language: getSelectedVideoLanguage(),
        input: inputSnapshot,
        context: {
          usedTitles: Array.isArray(state.videoAiHistory?.usedTitles) ? state.videoAiHistory.usedTitles.slice(0, 40) : [],
          recentIdeas: Array.isArray(state.videoAiHistory?.recentIdeas) ? state.videoAiHistory.recentIdeas.slice(0, 40) : [],
        },
        nonce: String(Date.now()),
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );

    state.videoAi.options = Array.isArray(res?.options) ? res.options.slice(0, 3) : [];
    const optionTitles = state.videoAi.options
      .map((item) => String(item?.title || "").trim())
      .filter(Boolean);
    if (optionTitles.length) {
      state.videoAiHistory.recentIdeas = [...new Set([...optionTitles, ...(state.videoAiHistory?.recentIdeas || [])])].slice(0, 60);
    }
    renderVideoAiSuggestions();

    if (res?.fallback) {
      showToast(t("toast.videoAiFallback", "AI đang dùng mẫu gợi ý cục bộ. Bạn vẫn có thể bấm tạo lại."), "info");
    } else {
      showToast(t("toast.videoAiReady", "AI đã tạo 3 phương án video."), "success");
    }
  } catch (err) {
    console.error("handleVideoAiAction error", err);
    state.videoAi.options = [];
    renderVideoAiSuggestions();
    showToast(err?.message || t("toast.videoAiFail", "Không thể tạo gợi ý video lúc này."), "error");
  } finally {
    state.videoAi.loading = false;
    state.videoAi.cooldownUntil = VIDEO_AI_COOLDOWN_MS > 0 ? Date.now() + VIDEO_AI_COOLDOWN_MS : 0;
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
      "Bấm AI gợi ý để nhận bộ mục tiêu cá nhân và mục tiêu tuần có thể áp dụng ngay."
    )}</div>`;
    return;
  }

  root.innerHTML = options
    .map((item, index) => {
      const goal = item?.goal || {};
      const habit = item?.habit || {};
      const weeklyPlan = item?.weeklyPlan || {};
      const goalTitle = String(goal?.title || "").trim() || t("ai.goalCopilot.optionUntitled", "Mục tiêu chưa có tên");
      const habitName = String(habit?.name || "").trim() || t("ai.goalCopilot.habitUntitled", "Thói quen chưa có tên");
      const reason = String(item?.reason || "").trim();
      const weeklyFocus = String(weeklyPlan?.focusTheme || "").trim();
      const weeklyPriorities = Array.isArray(weeklyPlan?.topPriorities)
        ? weeklyPlan.topPriorities.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 3)
        : [];
      const weeklyCommitment = String(weeklyPlan?.actionCommitments || "").trim();
      const safeGoalTitle = escapeHtml(goalTitle);
      const safeHabitName = escapeHtml(habitName);
      const safeReason = multilineToHtml(reason);
      const safePeriod = escapeHtml(String(goal?.period || "month"));
      const safeWeeklyFocus = escapeHtml(weeklyFocus || t("ai.goalCopilot.weeklyFocusFallback", "Chưa có trọng tâm tuần"));
      const safeWeeklyPriorities = weeklyPriorities.length
        ? weeklyPriorities.map((line) => `<li>${escapeHtml(line)}</li>`).join("")
        : `<li>${escapeHtml(t("ai.goalCopilot.weeklyPriorityFallback", "AI chưa gợi ý mục tiêu tuần cụ thể."))}</li>`;
      const safeWeeklyCommitment = escapeHtml(
        weeklyCommitment || t("ai.goalCopilot.weeklyCommitFallback", "Bổ sung cam kết hành động trước khi lưu.")
      );
      return `
        <article class="ai-suggestion-card">
          <div class="ai-suggestion-index">${t("ai.goalCopilot.optionIndex", "Phương án {{index}}").replace(
            "{{index}}",
            String(index + 1)
          )}</div>
          <div class="ai-suggestion-card-head">
            <strong>${safeGoalTitle}</strong>
            <span class="badge text-bg-light">${safePeriod}</span>
          </div>
          <div class="small mt-1">${t("ai.goalCopilot.habitLabel", "Thói quen đi kèm")}: ${safeHabitName}</div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.goalCopilot.weeklyFocusLabel", "Trọng tâm tuần")}</div>
            <div class="ai-suggestion-content">${safeWeeklyFocus}</div>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.goalCopilot.weeklyPriorityLabel", "3 mục tiêu tuần")}</div>
            <ul class="small mb-0 ps-3">${safeWeeklyPriorities}</ul>
          </div>
          <div class="mt-2">
            <div class="ai-suggestion-block-title">${t("ai.goalCopilot.weeklyCommitLabel", "Cam kết hành động")}</div>
            <div class="ai-suggestion-content">${safeWeeklyCommitment}</div>
          </div>
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
      ? t("ai.goalCopilot.generateLoading", "Äang táº¡o gá»£i ý...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thá»­ láº¡i sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.goalCopilot.generate", "AI gá»£i ý m:i");
  }

  if (improveBtn) {
    improveBtn.disabled = loading || onCooldown;
    improveBtn.textContent = loading
      ? t("ai.goalCopilot.improveLoading", "Äang cáº£i thi!n...")
      : onCooldown
      ? formatTemplate(t("ai.common.cooldown", "Thá»­ láº¡i sau {{sec}}s"), { sec: cooldownSec })
      : t("ai.goalCopilot.improve", "AI cáº£i thi!n ni dung");
  }
}

function readGoalContextInput() {
  return {
    goal: {
      title: (byId("goalTitle")?.value || "").trim(),
      area: byId("goalArea")?.value || "ca-nhan",
      period: byId("goalPeriod")?.value || "month",
      targetValue: Number(byId("goalTarget")?.value || 1),
      unit: (byId("goalUnit")?.value || "láº§n").trim(),
      dueDate: byId("goalDueDate")?.value || "",
      priority: byId("goalPriority")?.value || "medium",
      note: (byId("goalNote")?.value || "").trim(),
    },
    habit: {
      name: (byId("habitName")?.value || "").trim(),
      period: byId("habitPeriod")?.value || "day",
      targetCount: Number(byId("habitTarget")?.value || 1),
    },
    weeklyPlan: {
      focusTheme: (byId("weeklyFocusTheme")?.value || "").trim(),
      topPriorities: [
        (byId("weeklyGoal1")?.value || "").trim(),
        (byId("weeklyGoal2")?.value || "").trim(),
        (byId("weeklyGoal3")?.value || "").trim(),
      ].filter(Boolean),
      actionCommitments: (byId("weeklyActionPlan")?.value || "").trim(),
      weekKey: String(state.weeklyGoals?.weekKey || getCurrentGoalsWeekKey()).trim(),
    },
  };
}

function applyGoalBundle(option = {}) {
  const goal = option?.goal || {};
  const habit = option?.habit || {};
  const weeklyPlan = option?.weeklyPlan || {};
  setInputValue("goalTitle", String(goal?.title || "").trim());
  setInputValue("goalArea", String(goal?.area || "ca-nhan"));
  setInputValue("goalPeriod", String(goal?.period || "month"));
  setInputValue("goalTarget", String(Number(goal?.targetValue || 1)));
  setInputValue("goalUnit", String(goal?.unit || "láº§n").trim() || "láº§n");
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(goal?.dueDate || ""))) {
    setInputValue("goalDueDate", String(goal?.dueDate || ""));
  }
  setInputValue("goalPriority", String(goal?.priority || "medium"));
  setInputValue("goalNote", String(goal?.note || "").trim());

  setInputValue("habitName", String(habit?.name || "").trim());
  setInputValue("habitPeriod", String(habit?.period || "day"));
  setInputValue("habitTarget", String(Number(habit?.targetCount || 1)));

  const topPriorities = Array.isArray(weeklyPlan?.topPriorities)
    ? weeklyPlan.topPriorities.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  setInputValue("weeklyFocusTheme", String(weeklyPlan?.focusTheme || "").trim());
  setInputValue("weeklyGoal1", String(topPriorities[0] || ""));
  setInputValue("weeklyGoal2", String(topPriorities[1] || ""));
  setInputValue("weeklyGoal3", String(topPriorities[2] || ""));
  setInputValue("weeklyActionPlan", String(weeklyPlan?.actionCommitments || "").trim());
  const weeklyStatus = byId("goalsWeeklyStatus");
  if (weeklyStatus) {
    weeklyStatus.textContent = t("goals.weekly.unsaved", "Bạn đang có thay đổi chưa lưu cho mục tiêu tuần");
  }
}

async function handleGoalAiAction(mode = "generate") {
  const uid = ensureUser();
  if (!uid) return;
  if (state.goalAi.loading) return;

  const cooldownSec = getCooldownSeconds(state.goalAi.cooldownUntil);
  if (cooldownSec > 0) {
    showToast(
      formatTemplate(t("ai.common.cooldownToast", "Vui lòng chá» {{sec}} giây trÆ°:c khi gá»i AI tiáº¿p theo."), {
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
    const ai = await ensureAiServicesModule();
    const res = await ai.getGoalSuggestions(
      {
        mode: state.goalAi.mode,
        input: inputSnapshot,
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );

    state.goalAi.options = Array.isArray(res?.options) ? res.options.slice(0, 3) : [];
    renderGoalAiSuggestions();
    showToast(t("toast.goalAiReady", "AI ?ã táº¡o 3 phÆ°Æ¡ng án má»¥c tiêu cá nhân và má»¥c tiêu tuáº§n."), "success");
  } catch (err) {
    console.error("handleGoalAiAction error", err);
    state.goalAi.options = [];
    renderGoalAiSuggestions();
    showToast(
      err?.message || t("toast.goalAiFail", "Không thá»’ táº¡o gá»£i ý má»¥c tiêu lúc này."),
      "error"
    );
  } finally {
    state.goalAi.loading = false;
    state.goalAi.cooldownUntil = GOAL_AI_COOLDOWN_MS > 0 ? Date.now() + GOAL_AI_COOLDOWN_MS : 0;
    setGoalAiButtonsState();
    scheduleAiCooldownUiTick();
  }
}

async function bindDashboardEvents() {
  if (bindState.dashboard) return;
  const module = await ensureDashboardModule();
  bindState.dashboard = true;

  module.initDashboardEvents({
    onHabitCheckIn: async (habitId) => {
      try {
        await handleHabitCheckInAction(habitId);
      } catch (err) {
        console.error("dashboard check-in error", err);
        showToast(err?.message || t("toast.habitUpdateFail", "Không thá»’ cáº­p nháº­t thói quen"), "error");
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
    onOpenClasses: () => {
      if (location.hash !== "#classes") {
        location.hash = "#classes";
      }
    },
  });

  window.addEventListener("nexus:balances-updated", (event) => {
    const balances = Array.isArray(event?.detail) ? event.detail : [];
    state.accountBalances = balances;
    renderDashboardCenter();
  });
}

async function bindWeeklyReviewModule() {
  if (bindState.weeklyReview) return;
  const module = await ensureWeeklyReviewModule();
  bindState.weeklyReview = true;

  module.bindWeeklyReviewEvents({
    onFilterChange: ({ mode, weekKey, monthKey } = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const safeMode = normalizeWeeklyReviewMode(mode || state.weeklyReviewFilter?.mode || "week");
      const periodKey =
        safeMode === "month"
          ? String(monthKey || state.weeklyReviewFilter?.monthKey || getCurrentYm()).trim()
          : String(weekKey || state.weeklyReviewFilter?.weekKey || getCurrentWeekKeyForReview()).trim();
      void loadWeeklyReview(uid, periodKey, { mode: safeMode });
    },
  });
}

async function bindClassesModule() {
  if (bindState.classes) return;
  const module = await ensureClassesModule();
  if (!module?.bindClassesEvents) return;

  bindState.classes = true;
  module.bindClassesEvents({
    onChangeMode: async (mode) => {
      const uid = ensureUser();
      if (!uid) return;
      state.classesMode = persistClassesMode(mode);
      state.classSelectedSessionId = "";
      state.classRandomResult = null;
      state.classRandomHistory = [];
      await loadClasses(uid, { preserveSelection: false });
    },
    onChangeListTab: async (listTab) => {
      const uid = ensureUser();
      if (!uid) return;
      state.classesListTab = persistClassesListTab(listTab);
      state.classSelectedId = "";
      state.classSelectedSessionId = "";
      await loadClasses(uid, { preserveSelection: false });
    },
    onResetClassForm: async () => {
      state.classSelectedId = "";
      state.classSelectedSessionId = "";
      state.classStudents = [];
      state.classSessions = [];
      const uid = ensureUser();
      if (!uid) {
        await renderClassesPage();
        return;
      }
      await loadClasses(uid, { preserveSelection: false });
    },
    onSelectPresentationClass: async (classId) => {
      const uid = ensureUser();
      if (!uid) return;
      state.classesMode = persistClassesMode("presentation");
      state.classPresentationId = persistPresentationClass(classId);
      state.classRandomResult = null;
      state.classRandomHistory = [];
      await loadClasses(uid, {
        forceClassId: classId,
        preserveSelection: false,
      });
    },
    onSelectClass: async (classId) => {
      const uid = ensureUser();
      if (!uid) return;
      await loadClasses(uid, {
        forceClassId: classId,
        preserveSelection: false,
      });
    },
    onSelectSession: async (sessionId) => {
      state.classSelectedSessionId = String(sessionId || "").trim();
      await renderClassesPage();
    },
    onAddClass: async (payload = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      try {
        const slots = module.parseClassSlotsInput(payload?.slotsText || "");
        const created = await module.createClassWithSessions(uid, {
          code: payload?.code,
          title: payload?.title,
          startDate: payload?.startDate,
          slots,
          description: payload?.description || "",
          status: payload?.status || "active",
        });
        showToast(t("toast.classAdded", "? to lp mi."), "success");
        state.classesListTab = persistClassesListTab("active");
        await loadClasses(uid, {
          forceClassId: String(created?.id || ""),
          preserveSelection: false,
          listTab: "active",
        });
      } catch (err) {
        console.error("add class error", err);
        showToast(err?.message || t("toast.classCreateFail", "Khng th to lp hc"), "error");
      }
    },
    onSaveClass: async (payload = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(payload?.classId || state.classSelectedId || "").trim();
      if (!classId) {
        showToast(t("toast.classUpdateFail", "Khng th cp nht lp hc"), "error");
        return;
      }

      try {
        const slots = module.parseClassSlotsInput(payload?.slotsText || "");
        await module.updateClassInfo(uid, classId, {
          code: payload?.code,
          title: payload?.title,
          startDate: payload?.startDate,
          slots,
          description: payload?.description || "",
          status: payload?.status || "active",
        });
        showToast(t("toast.classUpdated", "? cp nht lp hc."), "success");
        const nextTab = String(payload?.status || "").trim() === "completed" ? "completed" : state.classesListTab;
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
          listTab: nextTab,
        });
      } catch (err) {
        console.error("save class error", err);
        showToast(err?.message || t("toast.classUpdateFail", "Khng th cp nht lp hc"), "error");
      }
    },
    onDeleteClass: async (payload = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(payload?.classId || state.classSelectedId || "").trim();
      if (!classId) return;
      openConfirmDelete("class", classId);
    },
    onReopenClass: async () => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      if (!classId) return;

      try {
        await module.reopenCompletedClass(uid, classId);
        state.classesListTab = persistClassesListTab("active");
        showToast(t("toast.classReopened", "? m li lp hc."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: false,
          listTab: "active",
        });
      } catch (err) {
        console.error("reopen class error", err);
        showToast(err?.message || t("toast.classReopenFail", "Khng th m li lp hc"), "error");
      }
    },
    onAddStudent: async ({ name } = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      if (!classId) {
        showToast(t("classes.selectClassFirst", "Vui lng chn lp trc khi thm hc sinh."), "info");
        return;
      }

      try {
        await module.addStudentToClass(uid, classId, {
          name: String(name || "").trim(),
          joinedFromSessionNo: resolveNextSessionNoForStudent(),
        });
        const input = byId("classStudentName");
        if (input) input.value = "";
        showToast(t("toast.classStudentAdded", "? thm hc sinh vo lp."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("add student error", err);
        showToast(err?.message || t("toast.classStudentAddFail", "Khng th thm hc sinh"), "error");
      }
    },
    onRemoveStudent: async (studentId) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sid = String(studentId || "").trim();
      if (!classId || !sid) return;

      try {
        await module.deactivateStudentFromNextSession(uid, classId, sid, resolveNextSessionNoForStudent());
        showToast(t("toast.classStudentRemoved", "? cp nht trng thi hc sinh t bui k."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("remove student error", err);
        showToast(err?.message || t("toast.classStudentUpdateFail", "Khng th cp nht hc sinh"), "error");
      }
    },
    onReactivateStudent: async (studentId) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sid = String(studentId || "").trim();
      if (!classId || !sid) return;

      try {
        await module.reactivateStudent(uid, classId, sid, resolveNextSessionNoForStudent());
        showToast(t("toast.classStudentReactivated", "? kch hot li hc sinh t bui k."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("reactivate student error", err);
        showToast(err?.message || t("toast.classStudentUpdateFail", "Khng th cp nht hc sinh"), "error");
      }
    },
    onSaveSession: async (payload = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sessionId = String(payload?.sessionId || state.classSelectedSessionId || "").trim();
      if (!classId || !sessionId) {
        showToast(t("toast.classSessionSaveFail", "Khng th lu bui hc"), "error");
        return;
      }

      try {
        await module.saveClassSessionData(uid, classId, sessionId, {
          status: payload?.status,
          teachingPlan: payload?.teachingPlan,
          teachingResultNote: payload?.teachingResultNote,
          reviews: payload?.reviews || {},
        });
        showToast(t("toast.classSessionSaved", "? lu ghi ch v nhn xt bui hc."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("save class session error", err);
        showToast(err?.message || t("toast.classSessionSaveFail", "Khng th lu bui hc"), "error");
      }
    },
    onShiftSessionNextWeek: async (payload = {}) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sessionId = String(payload?.sessionId || state.classSelectedSessionId || "").trim();
      if (!classId || !sessionId) {
        showToast(t("toast.classSessionShiftFail", "Khng th di bui hc"), "error");
        return;
      }

      try {
        await module.shiftSessionToNextWeek(uid, classId, sessionId, payload?.rescheduleReason || "");
        showToast(t("toast.classSessionShifted", "? di bui hc v cp nht lch chui k tip."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("shift class session error", err);
        showToast(err?.message || t("toast.classSessionShiftFail", "Khng th di bui hc"), "error");
      }
    },
    onAwardStar: async (studentId) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sid = String(studentId || "").trim();
      if (!classId || !sid) return;

      try {
        await module.awardStarToStudent(uid, classId, sid, 1);
        showToast(t("toast.classStarAwarded", "Đã cộng 1⭐ cho học sinh."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("award student star error", err);
        showToast(err?.message || t("toast.classStarAwardFail", "Không thể cộng sao cho học sinh."), "error");
      }
    },
    onRedeemStars: async (studentId) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sid = String(studentId || "").trim();
      if (!classId || !sid) return;

      try {
        await module.redeemStarsForStudent(uid, classId, sid, 5);
        showToast(t("toast.classStarsRedeemed", "Đã quy đổi sao thành điểm và reset sao."), "success");
        await loadClasses(uid, {
          forceClassId: classId,
          preserveSelection: true,
        });
      } catch (err) {
        console.error("redeem student stars error", err);
        showToast(
          err?.message || t("toast.classStarsRedeemFail", "Không thể quy đổi sao thành điểm."),
          "error"
        );
      }
    },
    onUpdateStudentPickPercent: async (studentId, pickPercent) => {
      const uid = ensureUser();
      if (!uid) return;
      const classId = String(state.classSelectedId || "").trim();
      const sid = String(studentId || "").trim();
      if (!classId || !sid) return;

      try {
        await module.updateStudentPickPercentValue(uid, classId, sid, normalizePickPercentInput(pickPercent));
        state.classStudents = state.classStudents.map((item) =>
          String(item?.id || "") === sid
            ? { ...item, pickPercent: normalizePickPercentInput(pickPercent) }
            : item
        );
        await renderClassesPage();
      } catch (err) {
        console.error("update student pick percent error", err);
        showToast(
          err?.message || t("toast.classPickPercentSaveFail", "Không thể cập nhật % random học sinh."),
          "error"
        );
      }
    },
    onRandomPick: async () => {
      const result = module.pickRandomStudentByPercent(state.classStudents || []);
      if (!result?.student) {
        showToast(t("toast.classRandomEmpty", "Lớp hiện không có học sinh đang hoạt động để random."), "info");
        return;
      }

      const now = new Date();
      const name = String(result.student?.name || "").trim();
      state.classRandomResult = {
        studentId: String(result.student?.id || "").trim(),
        name,
        at: now.toISOString(),
        atLabel: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };
      state.classRandomHistory = [state.classRandomResult, ...(state.classRandomHistory || [])].slice(0, 5);
      await renderClassesPage();
      showToast(
        formatTemplate(t("toast.classRandomPicked", "Đã random: {{name}}"), { name }),
        "success"
      );
    },
  });
}

function bindRouteSyncEvents() {
  if (bindState.routeSync) return;
  bindState.routeSync = true;

  const handleRouteChange = (forcedRouteId = "") => {
    const routeId = String(forcedRouteId || currentRouteId()).trim() || "dashboard";
    void preloadRouteModule(routeId);

    if (routeId === "video-plan") {
      setVideoPlanViewMode(state.videoCalendar?.viewMode || "board", { persist: false });
      if (state.pendingVideoFocusTaskId) {
        requestAnimationFrame(() => {
          focusPendingVideoTask();
        });
      }
    }

    const uid = state.currentUser?.uid;
    if (!uid) return;

    if (routeId === "dashboard") {
      void bindDashboardEvents().then(() => {
        renderDashboardCenter();
      });
    }

    if (routeId === "classes") {
      void bindClassesModule().then(() => {
        void loadClasses(uid, { preserveSelection: true });
      });
    }

    if (isWeeklyReviewRouteActive()) {
      const mode = normalizeWeeklyReviewMode(state.weeklyReviewFilter?.mode || "week");
      const periodKey =
        mode === "month"
          ? String(state.weeklyReviewFilter?.monthKey || getCurrentYm()).trim()
          : String(state.weeklyReviewFilter?.weekKey || getCurrentWeekKeyForReview()).trim();
      void bindWeeklyReviewModule().then(() => loadWeeklyReview(uid, periodKey, { mode }));
    }
  };

  window.addEventListener("hashchange", () => {
    handleRouteChange(currentRouteId());
  });

  window.addEventListener("nexus:route-changed", (event) => {
    handleRouteChange(event?.detail?.routeId);
  });
}

function bindGoalEvents() {
  renderGoalAiSuggestions();
  setGoalAiButtonsState();
  renderWeeklyGoalsPanel();

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
    showToast(t("toast.goalAiApplied", "Äã áp dá»¥ng gá»£i ý AI vào form má»¥c tiêu và má»¥c tiêu tuáº§n."), "success");
    await saveAppliedAiSuggestionSafe({
      type: "goal-bundle",
      mode: state.goalAi.mode || "generate",
      inputSnapshot: state.goalAi.inputSnapshot || {},
      appliedOutput: option,
      appliedAt: new Date(),
    });
  });

  byId("btnSaveWeeklyGoals")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const weekKey = String(state.weeklyGoals?.weekKey || getCurrentGoalsWeekKey()).trim();
    const payload = readWeeklyGoalsFormInput();

    try {
      setWeeklyGoalsSaveState({ status: "saving" });
      const saved = await saveWeeklyGoalsPlan(uid, weekKey, payload);
      state.weeklyGoals = {
        ...state.weeklyGoals,
        weekKey: String(saved?.weekKey || weekKey).trim(),
        plan: {
          ...(state.weeklyGoals?.plan || {}),
          ...(saved?.plan || {}),
        },
      };
      setWeeklyGoalsSaveState({
        status: "saved",
        savedAt: new Date(),
      });
      showToast(t("toast.weeklyGoalsSaved", "Äã lÆ°u má»¥c tiêu tuáº§n."), "success");
    } catch (err) {
      console.error("save weekly goals error", err);
      setWeeklyGoalsSaveState({ status: "error" });
      showToast(err?.message || t("toast.weeklyGoalsSaveFail", "Không thá»’ lÆ°u má»¥c tiêu tuáº§n."), "error");
    }
  });

  ["weeklyFocusTheme", "weeklyGoal1", "weeklyGoal2", "weeklyGoal3", "weeklyActionPlan"].forEach((id) => {
    byId(id)?.addEventListener("input", () => {
      const statusEl = byId("goalsWeeklyStatus");
      if (statusEl) {
        statusEl.textContent = t("goals.weekly.unsaved", "Bạn đang có thay đổi chưa lưu cho mục tiêu tuần");
      }
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
      unit: (byId("goalUnit")?.value || "láº§n").trim(),
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

      showToast(t("toast.goalAdded", "Äã táº¡o má»¥c tiêu m:i."), "success");
      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("createGoal error", err);
      showToast(err?.message || t("toast.goalCreateFail", "Không thá»’ táº¡o má»¥c tiêu"), "error");
    }
  });

  byId("btnAddHabit")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const payload = {
      name: (byId("habitName")?.value || "").trim(),
      period: byId("habitPeriod")?.value || "day",
      targetCount: Number(byId("habitTarget")?.value || 1),
      active: true,
    };

    try {
      await createHabit(uid, payload);
      setInputValue("habitName", "");
      setInputValue("habitTarget", "1");

      showToast(t("toast.habitAdded", "Äã táº¡o thói quen m:i."), "success");
      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("createHabit error", err);
      showToast(err?.message || t("toast.habitCreateFail", "Không thá»’ táº¡o thói quen"), "error");
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
        showToast(t("toast.goalProgressUpdated", "Äã cáº­p nháº­t tiáº¿n ? má»¥c tiêu."), "success");
      }

      if (btn.classList.contains("btn-goal-done")) {
        await markGoalDone(uid, goal.id);
        showToast(t("toast.goalDoneXp", "Äã hoàn thành má»¥c tiêu."), "success");
      }

      if (btn.classList.contains("btn-goal-del")) {
        await removeGoal(uid, goal.id);
        showToast(t("toast.goalDeleted", "Äã xóa má»¥c tiêu."), "success");
      }

      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("goal action error", err);
      showToast(err?.message || t("toast.goalUpdateFail", "Không thá»’ cáº­p nháº­t má»¥c tiêu"), "error");
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
      showToast(err?.message || t("toast.habitUpdateFail", "Không thá»’ cáº­p nháº­t thói quen"), "error");
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
        showToast(t("toast.habitDeleted", "Äã xóa thói quen."), "success");
      }

      await refreshGoalsAndMotivation(uid);
    } catch (err) {
      console.error("habit action error", err);
      showToast(err?.message || t("toast.habitUpdateFail", "Không thá»’ cáº­p nháº­t thói quen"), "error");
    }
  });
}

function bindVideoEvents() {
  if (bindState.video) return;
  bindState.video = true;

  const videoEditPanel = byId("editVideoTaskModal");
  const videoRetroPanel = byId("videoRetroPanel");
  renderVideoAiSuggestions();
  setVideoAiButtonsState();
  syncVideoBlueprintControls();
  setVideoPlanViewMode(state.videoCalendar?.viewMode || "board", { persist: false });

  const handleSelectCalendarDate = (dateKey) => {
    const value = String(dateKey || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    mergeVideoCalendarState(
      {
        selectedDate: value,
        monthAnchor: value.slice(0, 7),
      },
      { persist: true }
    );
    renderVideoBoardWithFilters();
  };

  byId("videoViewBoard")?.addEventListener("click", () => {
    setVideoPlanViewMode("board", { persist: true });
  });

  byId("videoViewCalendar")?.addEventListener("click", () => {
    setVideoPlanViewMode("calendar", { persist: true });
    renderVideoBoardWithFilters();
  });

  byId("btnVideoCalPrevMonth")?.addEventListener("click", () => {
    const nextYm = shiftYm(state.videoCalendar?.monthAnchor, -1);
    mergeVideoCalendarState(
      {
        monthAnchor: nextYm,
        selectedDate: `${nextYm}-01`,
      },
      { persist: true }
    );
    renderVideoBoardWithFilters();
  });

  byId("btnVideoCalNextMonth")?.addEventListener("click", () => {
    const nextYm = shiftYm(state.videoCalendar?.monthAnchor, 1);
    mergeVideoCalendarState(
      {
        monthAnchor: nextYm,
        selectedDate: `${nextYm}-01`,
      },
      { persist: true }
    );
    renderVideoBoardWithFilters();
  });

  byId("btnVideoCalToday")?.addEventListener("click", () => {
    const now = new Date();
    mergeVideoCalendarState(
      {
        selectedDate: getLocalDateKey(now),
        monthAnchor: toYmFromDate(now),
      },
      { persist: true }
    );
    renderVideoBoardWithFilters();
  });

  byId("videoPlanViewCalendar")?.addEventListener("click", (e) => {
    const dayBtn = e.target.closest("[data-date-key]");
    if (dayBtn?.dataset?.dateKey) {
      handleSelectCalendarDate(dayBtn.dataset.dateKey);
      return;
    }

    const openBtn = e.target.closest(".btn-video-calendar-open");
    const taskEl = e.target.closest(".calendar-agenda-item[data-task-id], .calendar-unscheduled-item[data-task-id]");
    const taskId = String(openBtn?.dataset?.id || taskEl?.dataset?.taskId || "").trim();
    if (!taskId) return;

    if (!openVideoEditTask(taskId)) {
      handleVideoFocusRequest(taskId);
    }
  });

  window.addEventListener("nexus:video-focus", (event) => {
    const taskId = String(event?.detail?.taskId || "").trim();
    if (!taskId) return;
    handleVideoFocusRequest(taskId);
  });

  byId("btnVideoAiGenerate")?.addEventListener("click", () => {
    void handleVideoAiAction("generate");
  });

  byId("btnVideoAiImprove")?.addEventListener("click", () => {
    void handleVideoAiAction("improve");
  });

  byId("videoAiLanguage")?.addEventListener("change", () => {
    syncVideoBlueprintControls();
  });

  byId("videoBlueprintType")?.addEventListener("change", () => {
    const selected = byId("videoBlueprintType")?.value || "short";
    setInputValue("videoType", selected);
    syncVideoBlueprintControls();
  });

  byId("videoType")?.addEventListener("change", () => {
    setInputValue("videoBlueprintType", byId("videoType")?.value || "short");
    syncVideoBlueprintControls();
  });

  byId("videoAiSuggestionList")?.addEventListener("click", async (e) => {
    const applyBtn = e.target.closest(".btn-video-ai-apply");
    if (!applyBtn) return;
    const index = Number(applyBtn?.dataset?.index);
    if (!Number.isFinite(index)) return;
    const option = state.videoAi.options[index];
    if (!option) return;

    applyVideoSuggestion(option);
    rememberVideoAiAppliedTitle(option?.title || "");
    showToast(t("toast.videoAiApplied", "Đã áp dụng phương án AI vào form video."), "success");
    await saveAppliedAiSuggestionSafe({
      type: "video-copilot",
      mode: state.videoAi.mode || "generate",
      inputSnapshot: state.videoAi.inputSnapshot || {},
      appliedOutput: option,
      appliedAt: new Date(),
    });
  });

  byId("btnVideoApplyBlueprint")?.addEventListener("click", () => {
    const selectedId = String(byId("videoBlueprintSelect")?.value || "").trim();
    if (!selectedId) {
      showToast(t("toast.blueprintApplyFail", "Không thá»’ áp dá»¥ng template ?ã chá»n."), "info");
      return;
    }

    const blueprint = (Array.isArray(state.contentBlueprints) ? state.contentBlueprints : []).find(
      (item) => String(item?.id || "").trim() === selectedId
    );
    if (!blueprint) {
      showToast(t("toast.blueprintApplyFail", "Không thá»’ áp dá»¥ng template ?ã chá»n."), "error");
      return;
    }

    const title = byId("videoTitle")?.value?.trim();
    if (!title) {
      setInputValue("videoTitle", blueprint.name || "");
    }
    setInputValue("videoShotList", blueprint.shotListTemplate || "");

    const note = [
      blueprint.hookTemplate ? `Hook: ${blueprint.hookTemplate}` : "",
      blueprint.outlineTemplate ? `Dàn ý:\n${blueprint.outlineTemplate}` : "",
      blueprint.ctaTemplate ? `CTA: ${blueprint.ctaTemplate}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (note) setInputValue("videoNote", note);

    setInputValue("videoType", blueprint.videoType || "short");
    setInputValue("videoBlueprintType", blueprint.videoType || "short");

    showToast(t("toast.blueprintApplied", "Äã áp dá»¥ng template vào form video."), "success");
  });

  byId("btnVideoSaveBlueprint")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    try {
      const payload = {
        name: (byId("videoTitle")?.value || "").trim() || t("videoPlan.blueprints.fallbackName", "Máº«u ni dung AI"),
        language: getSelectedBlueprintLanguage(),
        videoType: getSelectedVideoType(),
        hookTemplate: "",
        outlineTemplate: "",
        shotListTemplate: (byId("videoShotList")?.value || "").trim(),
        ctaTemplate: "",
        active: true,
      };

      const note = (byId("videoNote")?.value || "").trim();
      if (note) {
        payload.outlineTemplate = note;
      }

      await saveContentBlueprint(uid, payload);
      state.contentBlueprints = await loadContentBlueprints(uid);
      syncVideoBlueprintControls();
      showToast(t("toast.blueprintSaved", "Äã lÆ°u template ni dung."), "success");
    } catch (err) {
      console.error("save blueprint error", err);
      showToast(
        err?.message || t("toast.blueprintSaveFail", "Không thá»’ lÆ°u template ni dung."),
        "error"
      );
    }
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

  function openVideoEditTask(taskId = "") {
    const id = String(taskId || "").trim();
    if (!id) return false;
    const task = state.videoTasks.find((item) => item.id === id);
    if (!task) {
      showToast(t("toast.videoNotFound", "Không tìm tháº¥y công vi!c video"), "error");
      return false;
    }
    if (!videoEditPanel) {
      showToast(t("toast.videoUpdateFail", "Không thá»’ cáº­p nháº­t công vi!c video"), "error");
      return false;
    }

    fillVideoEditForm(task);
    bootstrap.Offcanvas.getOrCreateInstance(videoEditPanel)?.show();
    return true;
  }

  const resetVideoRetroForm = () => {
    ["vrTaskId", "vrPublishedAt", "vrDurationSec", "vrViews", "vrCtr", "vrRetention30s", "vrNote"].forEach(
      (id) => {
        const el = byId(id);
        if (el) el.value = "";
      }
    );
    const titleEl = byId("vrTaskTitle");
    if (titleEl) titleEl.textContent = "";
  };

  const fillVideoRetroForm = (task) => {
    if (!task) return;
    const retro = state.videoRetrosByTaskId?.[task.id] || null;

    setInputValue("vrTaskId", task.id || "");
    setInputValue("vrPublishedAt", toInputDate(retro?.publishedAt || task?.deadline));
    setInputValue("vrDurationSec", retro?.durationSec ?? "");
    setInputValue("vrViews", retro?.views ?? "");
    setInputValue("vrCtr", retro?.ctr ?? "");
    setInputValue("vrRetention30s", retro?.retention30s ?? "");
    setInputValue("vrNote", retro?.note || "");

    const titleEl = byId("vrTaskTitle");
    if (titleEl) {
      titleEl.textContent = String(task?.title || "").trim();
    }
  };

  videoEditPanel?.addEventListener("hidden.bs.offcanvas", resetVideoEditForm);
  videoRetroPanel?.addEventListener("hidden.bs.offcanvas", resetVideoRetroForm);

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
      setInputValue("videoType", "short");
      setInputValue("videoBlueprintType", "short");
      syncVideoBlueprintControls();

      showToast(t("toast.videoAdded", "Äã thêm công vi!c video m:i."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("createVideoTask error", err);
      showToast(err?.message || t("toast.videoCreateFail", "Không thá»’ táº¡o công vi!c video"), "error");
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
    const retroBtn = e.target.closest(".btn-video-retro-open");
    const editBtn = e.target.closest(".btn-video-edit");
    const deleteBtn = e.target.closest(".btn-video-del");

    if (retroBtn) {
      const task = state.videoTasks.find((item) => item.id === taskId);
      if (!task) {
        showToast(t("toast.videoNotFound", "Không tìm tháº¥y công vi!c video"), "error");
        return;
      }
      if (!videoRetroPanel) {
        showToast(t("toast.videoRetroOpenFail", "Không thá»’ mx dá»¯ li!u káº¿t quáº£ xuáº¥t báº£n."), "error");
        return;
      }

      fillVideoRetroForm(task);
      bootstrap.Offcanvas.getOrCreateInstance(videoRetroPanel)?.show();
      return;
    }

    if (editBtn) {
      openVideoEditTask(taskId);
      return;
    }

    if (!deleteBtn) {
      openVideoEditTask(taskId);
      return;
    }

    const uid = ensureUser();
    if (!uid) return;

    try {
      await removeVideoTask(uid, card.dataset.id);
      showToast(t("toast.videoDeleted", "Äã xóa công vi!c video."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("removeVideoTask error", err);
      showToast(err?.message || t("toast.videoDeleteFail", "Không thá»’ xóa công vi!c video"), "error");
    }
  });

  byId("btnVideoRetroSave")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const taskId = String(byId("vrTaskId")?.value || "").trim();
    if (!taskId) {
      showToast(t("toast.videoRetroOpenFail", "Không thá»’ mx dá»¯ li!u káº¿t quáº£ xuáº¥t báº£n."), "error");
      return;
    }
    const task = state.videoTasks.find((item) => item.id === taskId);
    if (!task) {
      showToast(t("toast.videoNotFound", "Không tìm tháº¥y công vi!c video"), "error");
      return;
    }

    const payload = {
      taskId,
      titleSnapshot: task.title || "",
      language: getSelectedBlueprintLanguage(),
      videoType: byId("videoType")?.value || "short",
      publishedAt: byId("vrPublishedAt")?.value || null,
      durationSec: Number(byId("vrDurationSec")?.value || 0),
      views: Number(byId("vrViews")?.value || 0),
      ctr: Number(byId("vrCtr")?.value || 0),
      retention30s: Number(byId("vrRetention30s")?.value || 0),
      note: (byId("vrNote")?.value || "").trim(),
    };

    try {
      const saved = await saveVideoRetro(uid, taskId, payload);
      state.videoRetrosByTaskId[taskId] = saved;
      renderVideoBoardWithFilters();
      if (videoRetroPanel) {
        bootstrap.Offcanvas.getOrCreateInstance(videoRetroPanel)?.hide();
      }
      showToast(t("toast.videoRetroSaved", "Äã lÆ°u káº¿t quáº£ xuáº¥t báº£n."), "success");
      await refreshWeeklyReviewIfVisible(uid);
    } catch (err) {
      console.error("saveVideoRetro error", err);
      showToast(
        err?.message || t("toast.videoRetroSaveFail", "Không thá»’ lÆ°u káº¿t quáº£ xuáº¥t báº£n."),
        "error"
      );
    }
  });

  byId("btnSaveVideoTask")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const taskId = (byId("evId")?.value || "").trim();
    if (!taskId) {
      showToast(t("toast.videoNotFound", "Không tìm tháº¥y công vi!c video"), "error");
      return;
    }
    if (!state.videoTasks.some((item) => item.id === taskId)) {
      showToast(t("toast.videoNotFound", "Không tìm tháº¥y công vi!c video"), "error");
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
      showToast(t("toast.videoUpdated", "Äã cáº­p nháº­t công vi!c video."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("updateVideoTaskDetails error", err);
      showToast(
        err?.message || t("toast.videoUpdateFail", "Không thá»’ cáº­p nháº­t công vi!c video"),
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
        showToast(t("toast.videoMoved", "Äã chuyá»’n bÆ°:c công vi!c video."), "success");
        await refreshVideoAndMotivation(uid);
      } catch (err) {
        console.error("moveTaskToStage error", err);
        showToast(err?.message || t("toast.videoMoveFail", "Không thá»’ chuyá»’n bÆ°:c"), "error");
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
      showToast(t("toast.csvExportSuccess", "Äã xuáº¥t CSV tháng hi!n táº¡i."), "success");
    } catch (err) {
      console.error("exportCsvCurrentMonth error", err);
      showToast(err?.message || t("toast.csvExportFail", "Xuáº¥t CSV tháº¥t báº¡i"), "error");
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
bindRouteSyncEvents();
bindGoalEvents();
bindVideoEvents();
bindExportEvent();
initSettingsModule();
let authBootstrapSettled = false;
let authBootstrapTimer = null;

function clearAuthBootstrapTimer() {
  if (authBootstrapTimer) {
    clearTimeout(authBootstrapTimer);
    authBootstrapTimer = null;
  }
}

function startAuthWarmStart() {
  const hasHint = hasAuthWarmHint();
  if (!hasHint) {
    setActiveRoute("auth");
    return;
  }

  const warmRoute = resolveWarmStartRoute();
  setGlobalLoading(true);
  setActiveRoute(warmRoute);
  void preloadRouteModule(warmRoute);

  authBootstrapTimer = setTimeout(() => {
    if (authBootstrapSettled) return;
    setGlobalLoading(false);
    if (!state.currentUser) {
      setActiveRoute("auth");
    }
  }, AUTH_BOOTSTRAP_TIMEOUT_MS);
}

void preloadRouteModule(resolveWarmStartRoute());
if (isWeeklyReviewRouteActive()) {
  void bindWeeklyReviewModule();
}
if (isClassesRouteActive()) {
  void bindClassesModule();
}
startAuthWarmStart();

byId("btnConfirmDelete")?.addEventListener("click", handleConfirmDelete);
byId("confirmDeleteModal")?.addEventListener("hidden.bs.offcanvas", clearPendingDeleteState);

watchAuth(async (user) => {
  authBootstrapSettled = true;
  clearAuthBootstrapTimer();

  state.currentUser = user || null;
  updateUserMenuUI(user || null);

  if (!user) {
    setGlobalLoading(false);
    setActiveRoute("auth");
    resetAppView();
    return;
  }

  setGlobalLoading(true);
  try {
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
    await preloadRouteModule(nextRoute);
    if (nextRoute === "dashboard") {
      await bindDashboardEvents();
    }
    if (nextRoute === "weekly-review") {
      await bindWeeklyReviewModule();
    }
    if (nextRoute === "classes") {
      await bindClassesModule();
    }
    await refreshAll(user.uid);
  } finally {
    setGlobalLoading(false);
  }
});



