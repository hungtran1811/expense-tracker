import { readUserSettings, saveUserSettings } from "../../services/firebase/firestore.js";
import { PROFILE_VI } from "../../shared/constants/profile.vi.js";

const MONTH_MODE = new Set(["current", "lastUsed"]);
const UI_DENSITY = new Set(["comfortable", "compact"]);
const START_ROUTE = new Set(["dashboard", "goals", "video-plan", "classes"]);

const DEFAULT_PROFILE = {
  displayName: PROFILE_VI.displayName || "Hưng Trần",
  tagline: PROFILE_VI.tagline || "",
  missionDefault: PROFILE_VI.missionDefault || "",
};

export const SETTINGS_DEFAULTS = Object.freeze({
  profile: {
    displayName: DEFAULT_PROFILE.displayName,
    tagline: DEFAULT_PROFILE.tagline,
    missionDefault: DEFAULT_PROFILE.missionDefault,
  },
  preferences: {
    dashboard: {
      nextActionsMax: 3,
      deadlineWindowHours: 72,
      startRoute: "dashboard",
    },
    filters: {
      monthMode: "current",
      lastMonth: "",
      rememberExpenseFilters: false,
      rememberIncomeFilters: false,
      rememberVideoFilters: false,
      expenseState: {
        category: "all",
        account: "all",
        search: "",
      },
      incomeState: {
        account: "all",
        search: "",
      },
      videoState: {
        stage: "all",
        priority: "all",
        query: "",
      },
    },
    ui: {
      density: "comfortable",
    },
  },
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isObject(base)) return clone(patch);
  if (!isObject(patch)) return clone(base);

  const out = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) return;
    if (isObject(value) && isObject(out[key])) {
      out[key] = deepMerge(out[key], value);
      return;
    }
    out[key] = clone(value);
  });
  return out;
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeMonth(ym) {
  const value = String(ym || "").trim();
  return /^\d{4}-\d{2}$/.test(value) ? value : "";
}

function normalizeProfile(profile = {}) {
  return {
    displayName: toText(profile.displayName, DEFAULT_PROFILE.displayName),
    tagline: toText(profile.tagline, DEFAULT_PROFILE.tagline),
    missionDefault: toText(profile.missionDefault, DEFAULT_PROFILE.missionDefault),
  };
}

function normalizeDashboardPrefs(prefs = {}) {
  const nextActionsMax = Number(prefs.nextActionsMax || 3);
  const deadlineWindowHours = Number(prefs.deadlineWindowHours || 72);
  const startRoute = START_ROUTE.has(String(prefs.startRoute || ""))
    ? String(prefs.startRoute)
    : SETTINGS_DEFAULTS.preferences.dashboard.startRoute;

  return {
    nextActionsMax: Number.isFinite(nextActionsMax) ? Math.min(6, Math.max(1, Math.floor(nextActionsMax))) : 3,
    deadlineWindowHours: Number.isFinite(deadlineWindowHours)
      ? Math.min(336, Math.max(12, Math.floor(deadlineWindowHours)))
      : 72,
    startRoute,
  };
}

function normalizeFilterState(raw = {}, fallback = {}) {
  return {
    ...fallback,
    ...Object.fromEntries(
      Object.entries(raw || {}).map(([key, value]) => [key, typeof value === "string" ? value : ""])
    ),
  };
}

function normalizeFilterPrefs(prefs = {}) {
  const monthMode = "current";

  return {
    monthMode,
    lastMonth: "",
    rememberExpenseFilters: toBool(prefs.rememberExpenseFilters, false),
    rememberIncomeFilters: toBool(prefs.rememberIncomeFilters, false),
    rememberVideoFilters: toBool(prefs.rememberVideoFilters, false),
    expenseState: normalizeFilterState(prefs.expenseState, SETTINGS_DEFAULTS.preferences.filters.expenseState),
    incomeState: normalizeFilterState(prefs.incomeState, SETTINGS_DEFAULTS.preferences.filters.incomeState),
    videoState: normalizeFilterState(prefs.videoState, SETTINGS_DEFAULTS.preferences.filters.videoState),
  };
}

function normalizeUiPrefs(prefs = {}) {
  const density = UI_DENSITY.has(String(prefs.density || "")) ? String(prefs.density) : "comfortable";
  return { density };
}

function normalizeRawSettings(raw = {}) {
  const profileRaw = raw?.profile || {};
  const prefsRaw = raw?.preferences || {};

  const normalized = {
    profile: normalizeProfile(profileRaw),
    preferences: {
      dashboard: normalizeDashboardPrefs(prefsRaw.dashboard || {}),
      filters: normalizeFilterPrefs(prefsRaw.filters || {}),
      ui: normalizeUiPrefs(prefsRaw.ui || {}),
    },
  };

  return deepMerge(clone(SETTINGS_DEFAULTS), normalized);
}

function buildLegacyPatch(partial = {}) {
  const profileDisplayName = partial?.profile?.displayName;
  if (!profileDisplayName) return {};
  return { displayName: profileDisplayName };
}

export function createDefaultSettings() {
  return clone(SETTINGS_DEFAULTS);
}

export function normalizeSettings(raw = {}) {
  return normalizeRawSettings(raw);
}

export function mergeSettingsPatch(baseSettings = createDefaultSettings(), patch = {}) {
  return normalizeSettings(deepMerge(baseSettings, patch));
}

export async function loadSettings(uid) {
  if (!uid) return createDefaultSettings();

  try {
    const raw = await readUserSettings(uid);
    return normalizeSettings(raw || {});
  } catch (err) {
    console.error("loadSettings error", err);
    return createDefaultSettings();
  }
}

export async function persistSettingsPatch(uid, partialPayload = {}) {
  if (!uid || !isObject(partialPayload)) return;
  const payload = deepMerge(partialPayload, buildLegacyPatch(partialPayload));
  await saveUserSettings(uid, payload);
}

export function applySettingsToApp(state, settings) {
  const normalized = normalizeSettings(settings);
  if (state && typeof state === "object") {
    state.settings = normalized;
  }

  PROFILE_VI.displayName = normalized.profile.displayName || DEFAULT_PROFILE.displayName;
  PROFILE_VI.shortName =
    String(PROFILE_VI.displayName || DEFAULT_PROFILE.displayName)
      .trim()
      .split(/\s+/)
      .pop() || "Hưng";
  PROFILE_VI.tagline = normalized.profile.tagline || DEFAULT_PROFILE.tagline;
  PROFILE_VI.missionDefault = normalized.profile.missionDefault || DEFAULT_PROFILE.missionDefault;

  return normalized;
}
