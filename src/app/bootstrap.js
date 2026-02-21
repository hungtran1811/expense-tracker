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
import { loadRouteModule, preloadRouteModule, loadAiServices } from "./moduleLoader.js";

const SETTINGS_DEBOUNCE_MS = 700;
const AI_REQUEST_TIMEOUT_MS = 15000;
const VIDEO_AI_COOLDOWN_MS = 2000;
const GOAL_AI_COOLDOWN_MS = 8000;
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
  aiTimer: null,
  aiCooldownUiTimer: null,
};

const bindState = {
  dashboard: false,
  video: false,
  weeklyReview: false,
  routeSync: false,
};

let dashboardModule = null;
let weeklyReviewModule = null;
let aiServicesModule = null;
let dashboardModulePromise = null;
let weeklyReviewModulePromise = null;

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

function isRouteActive(routeId) {
  return currentRouteId() === String(routeId || "").trim();
}

function isWeeklyReviewRouteActive() {
  return isRouteActive("weekly-review");
}

function isVideoPlanRouteActive() {
  return isRouteActive("video-plan");
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
  if (weeklyReviewModule?.renderWeeklyReviewSaveState) {
    weeklyReviewModule.renderWeeklyReviewSaveState(state.weeklyReviewSaveState);
  }
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
  if (weeklyReviewModule?.renderWeeklyReviewSaveState) {
    weeklyReviewModule.renderWeeklyReviewSaveState(state.weeklyReviewSaveState);
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
    if (partialPatch?.preferences?.dashboard) {
      renderVideoBoardWithFilters();
    }
    renderDashboardCenter();
    if (state.currentUser?.uid && isWeeklyReviewRouteActive()) {
      void loadWeeklyReview(state.currentUser.uid, state.weeklyReviewVm?.weekKey || "");
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

  setText("videoPlanTitle", "videoPlan.layout.pageTitle", "Kế hoạch video YouTube");
  setText(
    "videoPlanSubtitle",
    "videoPlan.layout.pageSubtitle",
    "Vận hành lịch sản xuất nội dung theo 6 giai đoạn rõ ràng và dễ theo dõi."
  );
  setText("videoCreateTitle", "videoPlan.layout.createTitle", "Tạo nhanh công việc video");
  setText(
    "videoCreateSubtitle",
    "videoPlan.layout.createSubtitle",
    "Điền thông tin cốt lõi, sau đó dùng AI hoặc template để hoàn thiện nội dung."
  );
  setText("videoFilterTitle", "videoPlan.layout.filtersTitle", "Bộ lọc và điều hướng");
  setText(
    "videoFilterSubtitle",
    "videoPlan.layout.filtersSubtitle",
    "Lọc theo giai đoạn, ưu tiên, trạng thái kết quả và từ khóa."
  );
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
  frontend: "Frontend thực chiến",
  backend: "Backend thực chiến",
  data_ai: "Data/AI ứng dụng",
  automation: "Tự động hóa thực tế",
  mobile: "Mobile app cơ bản",
  system_design: "System design nhập môn",
};

const VIDEO_TRACK_TOPICS = {
  python: ["Project Python cơ bản", "Tư duy giải bài toán từng bước", "Debug cho người mới"],
  javascript: ["Project JavaScript thuần", "DOM và event thực chiến", "Mini app chạy được ngay"],
  frontend: ["UI/UX cho người mới", "Responsive thực tế", "Tối ưu trải nghiệm người dùng"],
  backend: ["Xây API từ đầu", "Auth và bảo mật cơ bản", "Database cho dự án nhỏ"],
  data_ai: ["Phân tích dữ liệu dễ hiểu", "Ứng dụng AI vào bài toán thật", "Mini project với model có sẵn"],
  automation: ["Tự động hóa tác vụ lặp lại", "Script tiết kiệm thời gian", "Workflow cá nhân hóa"],
  mobile: ["Mini app mobile cho người mới", "Navigation và state cơ bản", "Tối ưu trải nghiệm trên điện thoại"],
  system_design: ["Thiết kế hệ thống nhập môn", "Scalability cơ bản", "Tư duy kiến trúc qua ví dụ đơn giản"],
};

const VIDEO_TRACK_KEYWORDS = {
  python: ["python", "pandas", "django", "fastapi", "flask"],
  javascript: ["javascript", "js", "node", "react", "vue"],
  frontend: ["frontend", "ui", "ux", "css", "html"],
  backend: ["backend", "api", "server", "database", "auth"],
  data_ai: ["ai", "data", "machine learning", "llm", "pandas", "numpy"],
  automation: ["automation", "tự động", "workflow", "script", "bot"],
  mobile: ["mobile", "android", "ios", "react native", "flutter"],
  system_design: ["system design", "kiến trúc", "scalability", "cache", "queue"],
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
          const name = escapeHtml(String(item?.name || "").trim() || t("videoPlan.blueprints.fallbackName", "Mẫu nội dung AI"));
          return `<option value="${escapeHtml(id)}">${name}</option>`;
        })
        .join("")
    : `<option value="">${escapeHtml(t("videoPlan.blueprints.noData", "Chưa có template phù hợp. Hãy tạo từ AI gợi ý đầu tiên."))}</option>`;

  select.innerHTML = `<option value="">${escapeHtml(
    t("videoPlan.blueprints.placeholder", "Chọn mẫu nội dung")
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

async function loadWeeklyReview(uid, weekKey = "") {
  if (!uid) return;

  const module = await ensureWeeklyReviewModule();
  const targetWeekKey = String(weekKey || state.weeklyReviewVm?.weekKey || "").trim();
  const vm = await module.buildWeeklyReviewVM(uid, targetWeekKey, weeklyReviewOptions());
  state.weeklyReviewVm = vm;
  module.renderWeeklyReviewPage(vm, state.weeklyReviewSaveState);
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
      loadAccountsRuntime(uid, state),
      loadFinance(uid),
      loadGoals(uid),
      loadVideo(uid),
      loadMotivation(uid),
      loadBalancesRuntime(uid, state, renderDashboardCenter),
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
  resetExpenseAiHint();
  renderMotivationDashboard(byId("dashboardMotivation"), state.motivation);
  renderMotivationDetails(state.motivation);
  if (weeklyReviewModule?.renderWeeklyReviewPage) {
    weeklyReviewModule.renderWeeklyReviewPage(null, state.weeklyReviewSaveState);
  }

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
        t("ai.videoCopilot.optionUntitled", "Phương án chưa có tiêu đề");
      const priority = String(item?.priority || "medium").trim();
      const deadline = String(item?.deadlineSuggestion || "").trim();
      const note = String(item?.note || "").trim();
      const shotList = String(item?.shotList || "").trim();
      const reason = String(item?.reason || "").trim();
      const hook = String(item?.hook || "").trim();
      const outline = String(item?.outline || "").trim();
      const cta = String(item?.cta || "").trim();
      const videoType = String(item?.videoType || "").trim();
      const optionIndexLabel = formatTemplate(t("ai.videoCopilot.optionIndex", "Phương án {{index}}"), {
        index: index + 1,
      });
      const safeTitle = escapeHtml(title);
      const safePriority = escapeHtml(priority);
      const safeReason = multilineToHtml(reason);
      const safeShotList = multilineToHtml(shotList);
      const safeNote = multilineToHtml(note);
      const safeHook = multilineToHtml(hook);
      const safeOutline = multilineToHtml(outline);
      const safeCta = multilineToHtml(cta);
      const videoTypeLabel =
        videoType === "short_30s"
          ? t("videoPlan.blueprints.short", "Video ngắn 30s")
          : t("videoPlan.blueprints.long", "Video dài 5-10 phút");

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
                ? `${t("ai.videoCopilot.deadline", "Hạn gợi ý")}: ${escapeHtml(deadline)}`
                : t("ai.videoCopilot.noDeadline", "Không có hạn gợi ý")
            }
          </div>
          <div class="ai-suggestion-meta small text-muted">
            ${t("ai.videoCopilot.videoTypeLabel", "Định dạng video")}: ${escapeHtml(videoTypeLabel)}
          </div>
          ${
            reason
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.reasonLabel", "Lý do gợi ý")}</div>
                   <div class="small">${safeReason}</div>
                 </div>`
              : ""
          }
          ${
            hook
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.hookLabel", "Hook mở đầu")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeHook}</div>
                 </div>`
              : ""
          }
          ${
            outline
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.outlineLabel", "Dàn ý triển khai")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeOutline}</div>
                 </div>`
              : ""
          }
          ${
            shotList
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.shotListLabel", "Danh sách cảnh quay")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeShotList}</div>
                 </div>`
              : ""
          }
          ${
            cta
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.ctaLabel", "Kêu gọi hành động")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeCta}</div>
                 </div>`
              : ""
          }
          ${
            note
              ? `<div class="ai-suggestion-block mt-2">
                   <div class="ai-suggestion-block-title">${t("ai.videoCopilot.noteLabel", "Ghi chú triển khai")}</div>
                   <div class="small text-muted ai-suggestion-content">${safeNote}</div>
                 </div>`
              : ""
          }
          <div class="mt-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-primary btn-video-ai-apply" data-index="${index}">
              ${t("ai.common.apply", "Áp dụng toàn bộ")}
            </button>
            <button class="btn btn-sm btn-outline-secondary btn-video-ai-save-blueprint" data-index="${index}">
              ${t("ai.videoCopilot.saveTemplate", "Lưu thành template")}
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
    videoType: byId("videoType")?.value || "short",
    scriptUrl: (byId("videoScriptUrl")?.value || "").trim(),
    shotList: (byId("videoShotList")?.value || "").trim(),
    assetLinks: (byId("videoAssetLinks")?.value || "").trim(),
    note: (byId("videoNote")?.value || "").trim(),
  };
}

function normalizeIdeaTitle(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectUsedVideoTitlesFromTasks() {
  return (Array.isArray(state.videoTasks) ? state.videoTasks : [])
    .map((item) => String(item?.title || "").trim())
    .filter(Boolean);
}

async function loadVideoAiHistory(uid) {
  const now = Date.now();
  const cacheMs = 90 * 1000;
  if (state.videoAiHistory?.loadedAt && now - state.videoAiHistory.loadedAt < cacheMs) {
    return state.videoAiHistory;
  }

  const taskTitles = collectUsedVideoTitlesFromTasks();
  const currentOptionTitles = (Array.isArray(state.videoAi?.options) ? state.videoAi.options : [])
    .map((item) => String(item?.title || "").trim())
    .filter(Boolean);
  let aiTitles = [];
  let recentIdeas = [];

  try {
    const applied = await listAppliedAiSuggestions(uid, { type: "video-copilot", limitCount: 60 });
    aiTitles = (Array.isArray(applied) ? applied : [])
      .map((item) => {
        const outputTitle = String(item?.appliedOutput?.title || "").trim();
        const inputTitle = String(item?.inputSnapshot?.title || "").trim();
        return outputTitle || inputTitle;
      })
      .filter(Boolean);

    recentIdeas = (Array.isArray(applied) ? applied : [])
      .map((item) => String(item?.appliedOutput?.title || "").trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch (err) {
    console.error("loadVideoAiHistory error", err);
  }

  const uniqueMap = new Map();
  [...taskTitles, ...aiTitles].forEach((title) => {
    const key = normalizeIdeaTitle(title);
    if (!key || uniqueMap.has(key)) return;
    uniqueMap.set(key, title);
  });

  const mergedRecent = [...currentOptionTitles, ...recentIdeas];
  const uniqueRecent = [];
  const recentKeys = new Set();
  for (const title of mergedRecent) {
    const key = normalizeIdeaTitle(title);
    if (!key || recentKeys.has(key)) continue;
    recentKeys.add(key);
    uniqueRecent.push(title);
    if (uniqueRecent.length >= 20) break;
  }

  state.videoAiHistory = {
    loadedAt: now,
    usedTitles: Array.from(uniqueMap.values()).slice(0, 80),
    recentIdeas: uniqueRecent,
  };
  return state.videoAiHistory;
}

function rememberVideoAiAppliedTitle(title = "") {
  const safeTitle = String(title || "").trim();
  const key = normalizeIdeaTitle(safeTitle);
  if (!key) return;

  const currentUsed = Array.isArray(state.videoAiHistory?.usedTitles) ? state.videoAiHistory.usedTitles : [];
  const currentRecent = Array.isArray(state.videoAiHistory?.recentIdeas) ? state.videoAiHistory.recentIdeas : [];

  const used = [];
  const usedKeys = new Set();
  [safeTitle, ...currentUsed].forEach((item) => {
    const ideaKey = normalizeIdeaTitle(item);
    if (!ideaKey || usedKeys.has(ideaKey)) return;
    usedKeys.add(ideaKey);
    used.push(String(item || "").trim());
  });

  const recent = [];
  const recentKeys = new Set();
  [safeTitle, ...currentRecent].forEach((item) => {
    const ideaKey = normalizeIdeaTitle(item);
    if (!ideaKey || recentKeys.has(ideaKey)) return;
    recentKeys.add(ideaKey);
    recent.push(String(item || "").trim());
  });

  state.videoAiHistory = {
    loadedAt: Date.now(),
    usedTitles: used.slice(0, 80),
    recentIdeas: recent.slice(0, 20),
  };
}

function detectVideoLanguageHint(input = {}) {
  const selectedTrack = normalizeVideoTrack(byId("videoAiLanguage")?.value || "", "");
  if (selectedTrack) return selectedTrack;

  const text = [
    String(input?.title || ""),
    String(input?.note || ""),
    String(input?.shotList || ""),
  ]
    .join(" ")
    .toLowerCase();

  const matched = VIDEO_TRACKS.find((track) =>
    (VIDEO_TRACK_KEYWORDS[track] || []).some((kw) => text.includes(String(kw || "").toLowerCase()))
  );
  return matched || "python";
}

function buildVideoAiContext({ track = "python", usedTitles = [], recentIdeas = [] } = {}) {
  const safeTrack = normalizeVideoTrack(track, "python");
  const profile = state?.settings?.profile || {};
  return {
    channelFocus:
      "Kênh YouTube hướng dẫn lập trình qua dự án thực tế đơn giản, dễ hiểu cho học sinh và người mới bắt đầu.",
    targetAudience: "Học sinh, sinh viên và người mới bắt đầu học lập trình",
    creatorGoal:
      "Ưu tiên nội dung có thể quay nhanh, dạy rõ ràng, tạo giá trị thực tế và duy trì lịch đăng đều.",
    selectedTrack: safeTrack,
    selectedTrackLabel: VIDEO_TRACK_LABEL[safeTrack] || "Python",
    preferredTopics: VIDEO_TRACK_TOPICS[safeTrack] || VIDEO_TRACK_TOPICS.python,
    tone: "Đóng vai content creator thực chiến, giàu ý tưởng mới, không máy móc, tập trung hành động.",
    ownerName: String(profile?.displayName || "Hưng Trần").trim(),
    ownerTagline: String(profile?.tagline || "").trim(),
    outputRule:
      "Mỗi phương án phải có hook, dàn ý, shot list, CTA, note; luôn có videoType short_30s hoặc long_5_10.",
    usedTitles: (Array.isArray(usedTitles) ? usedTitles : []).slice(0, 80),
    recentIdeas: (Array.isArray(recentIdeas) ? recentIdeas : []).slice(0, 12),
  };
}

function applyVideoSuggestion(option = {}) {
  if (!option || typeof option !== "object") return;
  setInputValue("videoTitle", String(option?.title || "").trim());
  setInputValue("videoPriority", String(option?.priority || "medium").trim() || "medium");
  setInputValue("videoShotList", String(option?.shotList || "").trim());
  setInputValue("videoAssetLinks", String(option?.assetLinks || "").trim());
  const noteSections = [
    String(option?.hook || "").trim() ? `Hook: ${String(option?.hook || "").trim()}` : "",
    String(option?.outline || "").trim() ? `Dàn ý:\n${String(option?.outline || "").trim()}` : "",
    String(option?.cta || "").trim() ? `CTA: ${String(option?.cta || "").trim()}` : "",
    String(option?.note || "").trim(),
  ].filter(Boolean);
  setInputValue("videoNote", noteSections.join("\n\n"));
  const videoType = String(option?.videoType || "").trim();
  if (videoType === "short_30s") {
    setInputValue("videoType", "short");
    setInputValue("videoBlueprintType", "short");
  } else if (videoType === "long_5_10") {
    setInputValue("videoType", "long");
    setInputValue("videoBlueprintType", "long");
  }
  const deadline = String(option?.deadlineSuggestion || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    setInputValue("videoDeadline", deadline);
  }
  syncVideoBlueprintControls();
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
  let shouldCooldown = false;
  setVideoAiButtonsState();
  try {
    const inputSnapshot = readVideoFormInput();
    const track = detectVideoLanguageHint(inputSnapshot);
    const history = await loadVideoAiHistory(uid);
    state.videoAi.inputSnapshot = inputSnapshot;
    const ai = await ensureAiServicesModule();
    const res = await ai.getVideoCopilotSuggestions(
      {
        mode: state.videoAi.mode,
        input: inputSnapshot,
        language: track,
        context: buildVideoAiContext({
          track,
          usedTitles: history?.usedTitles || [],
          recentIdeas: history?.recentIdeas || [],
        }),
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );

    state.videoAi.options = Array.isArray(res?.options) ? res.options.slice(0, 3) : [];
    shouldCooldown = true;
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
    state.videoAi.cooldownUntil = shouldCooldown ? Date.now() + VIDEO_AI_COOLDOWN_MS : 0;
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
    state.goalAi.cooldownUntil = Date.now() + GOAL_AI_COOLDOWN_MS;
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
    const module = await ensureWeeklyReviewModule();
    const normalizedPlan = module.parseWeeklyPlanInput(planInput);
    const baseVm = state.weeklyReviewVm || (await module.buildWeeklyReviewVM(uid, "", weeklyReviewOptions()));
    state.weeklyReviewVm = baseVm;

    setWeeklyReviewSaveState({ status: "saving" });
    const savedPlan = await module.saveWeeklyReviewPlan(uid, baseVm, normalizedPlan);

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

async function bindWeeklyReviewModule() {
  if (bindState.weeklyReview) return;
  const module = await ensureWeeklyReviewModule();
  bindState.weeklyReview = true;

  module.bindWeeklyReviewEvents({
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

    if (isWeeklyReviewRouteActive()) {
      resetWeeklyReviewSaveState();
      void bindWeeklyReviewModule().then(() => loadWeeklyReview(uid, ""));
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
    const saveBtn = e.target.closest(".btn-video-ai-save-blueprint");
    if (!applyBtn && !saveBtn) return;

    const btn = applyBtn || saveBtn;
    const index = Number(btn?.dataset?.index);
    if (!Number.isFinite(index)) return;
    const option = state.videoAi.options[index];
    if (!option) return;

    if (applyBtn) {
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
      return;
    }

    if (saveBtn) {
      const uid = ensureUser();
      if (!uid) return;
      try {
        const payload = buildBlueprintPayloadFromSuggestion(option, getSelectedBlueprintLanguage());
        await saveContentBlueprint(uid, payload);
        state.contentBlueprints = await loadContentBlueprints(uid);
        syncVideoBlueprintControls();
        showToast(t("toast.blueprintSaved", "Đã lưu template nội dung."), "success");
      } catch (err) {
        console.error("save blueprint from ai error", err);
        showToast(
          err?.message || t("toast.blueprintSaveFail", "Không thể lưu template nội dung."),
          "error"
        );
      }
    }
  });

  byId("btnVideoApplyBlueprint")?.addEventListener("click", () => {
    const selectedId = String(byId("videoBlueprintSelect")?.value || "").trim();
    if (!selectedId) {
      showToast(t("toast.blueprintApplyFail", "Không thể áp dụng template đã chọn."), "info");
      return;
    }

    const blueprint = (Array.isArray(state.contentBlueprints) ? state.contentBlueprints : []).find(
      (item) => String(item?.id || "").trim() === selectedId
    );
    if (!blueprint) {
      showToast(t("toast.blueprintApplyFail", "Không thể áp dụng template đã chọn."), "error");
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

    showToast(t("toast.blueprintApplied", "Đã áp dụng template vào form video."), "success");
  });

  byId("btnVideoSaveBlueprint")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    try {
      const payload = {
        name: (byId("videoTitle")?.value || "").trim() || t("videoPlan.blueprints.fallbackName", "Mẫu nội dung AI"),
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
      showToast(t("toast.blueprintSaved", "Đã lưu template nội dung."), "success");
    } catch (err) {
      console.error("save blueprint error", err);
      showToast(
        err?.message || t("toast.blueprintSaveFail", "Không thể lưu template nội dung."),
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
      showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
      return false;
    }
    if (!videoEditPanel) {
      showToast(t("toast.videoUpdateFail", "Không thể cập nhật công việc video"), "error");
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
    const retroBtn = e.target.closest(".btn-video-retro-open");
    const editBtn = e.target.closest(".btn-video-edit");
    const deleteBtn = e.target.closest(".btn-video-del");

    if (retroBtn) {
      const task = state.videoTasks.find((item) => item.id === taskId);
      if (!task) {
        showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
        return;
      }
      if (!videoRetroPanel) {
        showToast(t("toast.videoRetroOpenFail", "Không thể mở dữ liệu kết quả xuất bản."), "error");
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
      showToast(t("toast.videoDeleted", "Đã xóa công việc video."), "success");
      await refreshVideoAndMotivation(uid);
    } catch (err) {
      console.error("removeVideoTask error", err);
      showToast(err?.message || t("toast.videoDeleteFail", "Không thể xóa công việc video"), "error");
    }
  });

  byId("btnVideoRetroSave")?.addEventListener("click", async () => {
    const uid = ensureUser();
    if (!uid) return;

    const taskId = String(byId("vrTaskId")?.value || "").trim();
    if (!taskId) {
      showToast(t("toast.videoRetroOpenFail", "Không thể mở dữ liệu kết quả xuất bản."), "error");
      return;
    }
    const task = state.videoTasks.find((item) => item.id === taskId);
    if (!task) {
      showToast(t("toast.videoNotFound", "Không tìm thấy công việc video"), "error");
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
      showToast(t("toast.videoRetroSaved", "Đã lưu kết quả xuất bản."), "success");
      await refreshWeeklyReviewIfVisible(uid);
    } catch (err) {
      console.error("saveVideoRetro error", err);
      showToast(
        err?.message || t("toast.videoRetroSaveFail", "Không thể lưu kết quả xuất bản."),
        "error"
      );
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
bindRouteSyncEvents();
bindGoalEvents();
bindVideoEvents();
bindExportEvent();
initSettingsModule();
void preloadRouteModule(currentRouteId());
if (isWeeklyReviewRouteActive()) {
  void bindWeeklyReviewModule();
}

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
  await preloadRouteModule(nextRoute);
  if (nextRoute === "dashboard") {
    await bindDashboardEvents();
  }
  if (nextRoute === "weekly-review") {
    await bindWeeklyReviewModule();
  }
  await refreshAll(user.uid);
});
