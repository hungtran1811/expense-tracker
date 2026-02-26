import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { mergeSettingsPatch } from "./settings.controller.js";

const TEXT_IDS = ["stDisplayName", "stTagline", "stMissionDefault"];
const IMMEDIATE_SAVE_IDS = new Set(["stDisplayName", "stTagline", "stMissionDefault"]);

const FIELD_PATCHERS = {
  stDisplayName: (el) => ({
    profile: { displayName: el.value || "" },
  }),
  stTagline: (el) => ({
    profile: { tagline: el.value || "" },
  }),
  stMissionDefault: (el) => ({
    profile: { missionDefault: el.value || "" },
  }),
  stNextActionsMax: (el) => ({
    preferences: { dashboard: { nextActionsMax: Number(el.value || 3) } },
  }),
  stDeadlineWindowHours: (el) => ({
    preferences: { dashboard: { deadlineWindowHours: Number(el.value || 72) } },
  }),
  stStartRoute: (el) => ({
    preferences: { dashboard: { startRoute: el.value || "dashboard" } },
  }),
  stMonthMode: (el) => ({
    preferences: { filters: { monthMode: el.value || "current" } },
  }),
  stRememberExpenseFilters: (el) => ({
    preferences: { filters: { rememberExpenseFilters: !!el.checked } },
  }),
  stRememberIncomeFilters: (el) => ({
    preferences: { filters: { rememberIncomeFilters: !!el.checked } },
  }),
  stRememberVideoFilters: (el) => ({
    preferences: { filters: { rememberVideoFilters: !!el.checked } },
  }),
  stUiDensity: (el) => ({
    preferences: { ui: { density: el.value || "comfortable" } },
  }),
};

let _eventsBound = false;

function byId(id) {
  return document.getElementById(id);
}

function setValue(id, value = "") {
  const el = byId(id);
  if (!el) return;
  el.value = value;
}

function setChecked(id, value) {
  const el = byId(id);
  if (!el) return;
  el.checked = !!value;
}

function setText(id, text = "") {
  const el = byId(id);
  if (!el) return;
  el.textContent = text;
}

function setPlaceholder(id, text = "") {
  const el = byId(id);
  if (!el) return;
  el.setAttribute("placeholder", text);
}

function setSelectValue(id, value, fallback = "") {
  const el = byId(id);
  if (!el) return;
  const target = String(value ?? "");
  if ([...el.options].some((opt) => opt.value === target)) {
    el.value = target;
    return;
  }
  el.value = fallback;
}

function statusClass(status = "idle") {
  if (status === "saving") return "text-primary";
  if (status === "saved") return "text-success";
  if (status === "error") return "text-danger";
  return "text-muted";
}

function statusText(saveState = {}) {
  const status = saveState?.status || "idle";
  if (status === "saving") {
    return t("settings.status.saving", "Đang lưu...");
  }
  if (status === "saved") {
    if (saveState?.savedAt instanceof Date && !Number.isNaN(saveState.savedAt.getTime())) {
      return formatTemplate(t("settings.status.savedAt", "Đã lưu lúc {{time}}"), {
        time: saveState.savedAt.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
    return t("settings.status.saved", "Đã lưu");
  }
  if (status === "error") {
    return t("settings.status.error", "Lưu thất bại");
  }
  return t("settings.status.idle", "Thay đổi sẽ tự động lưu");
}

export function renderSettingsSaveState(saveState = {}) {
  const el = byId("stSaveStatus");
  if (!el) return;

  el.classList.remove("text-primary", "text-success", "text-danger", "text-muted");
  el.classList.add(statusClass(saveState?.status || "idle"));
  el.textContent = statusText(saveState);
}

export function renderSettingsForm(settings, saveState = {}) {
  const safe = mergeSettingsPatch({}, settings || {});

  setText("stTabProfile", t("settings.tabs.profile", "Hồ sơ cá nhân"));
  setText("stTabDashboard", t("settings.tabs.dashboard", "Tùy chọn Dashboard"));
  setText("stTabFilters", t("settings.tabs.filters", "Bộ lọc & Hiển thị"));

  setText("stProfileTitle", t("settings.profile.title", "Hồ sơ cá nhân"));
  setText(
    "stProfileSub",
    t("settings.profile.subtitle", "Thông tin này ảnh hưởng trực tiếp đến dashboard cá nhân hóa.")
  );
  setText("stLabelDisplayName", t("settings.profile.displayName", "Tên hiển thị"));
  setText("stLabelTagline", t("settings.profile.tagline", "Tagline"));
  setText("stLabelMissionDefault", t("settings.profile.missionDefault", "Nhiệm vụ mặc định"));
  setPlaceholder("stDisplayName", t("settings.profile.displayNamePlaceholder", "Ví dụ: Hưng Trần"));
  setPlaceholder(
    "stTagline",
    t("settings.profile.taglinePlaceholder", "Ví dụ: Tập trung tăng trưởng nội dung đều mỗi tuần")
  );
  setPlaceholder(
    "stMissionDefault",
    t("settings.profile.missionDefaultPlaceholder", "Ví dụ: Hoàn thành 1 bước video và 1 hành động tài chính")
  );

  setText("stDashboardTitle", t("settings.preferences.dashboard.title", "Tùy chọn Dashboard"));
  setText("stLabelNextActionsMax", t("settings.preferences.dashboard.nextActionsMax", "Số việc kế tiếp hiển thị"));
  setText(
    "stLabelDeadlineWindowHours",
    t("settings.preferences.dashboard.deadlineWindowHours", "Khung giờ cảnh báo cận hạn")
  );
  setText("stLabelStartRoute", t("settings.preferences.dashboard.startRoute", "Route mặc định sau đăng nhập"));
  setText("stOptStartDashboard", t("settings.preferences.dashboard.startRouteOptions.dashboard", "Trung tâm"));
  setText("stOptStartGoals", t("settings.preferences.dashboard.startRouteOptions.goals", "Mục tiêu"));
  setText("stOptStartVideoPlan", t("settings.preferences.dashboard.startRouteOptions.videoPlan", "Kế hoạch video"));
  setText("stOptStartClasses", t("settings.preferences.dashboard.startRouteOptions.classes", "Lớp học"));

  setText("stFiltersTitle", t("settings.preferences.filters.title", "Bộ lọc & Hiển thị"));
  setText("stLabelMonthMode", t("settings.preferences.filters.monthMode", "Chế độ tháng mặc định"));
  setText("stOptMonthCurrent", t("settings.preferences.filters.monthModeOptions.current", "Luôn về tháng hiện tại"));
  setText("stOptMonthLastUsed", t("settings.preferences.filters.monthModeOptions.lastUsed", "Nhớ tháng đã dùng gần nhất"));
  setText(
    "stLabelRememberExpenseFilters",
    t("settings.preferences.filters.rememberExpenseFilters", "Nhớ bộ lọc Chi tiêu")
  );
  setText(
    "stLabelRememberIncomeFilters",
    t("settings.preferences.filters.rememberIncomeFilters", "Nhớ bộ lọc Thu nhập")
  );
  setText(
    "stLabelRememberVideoFilters",
    t("settings.preferences.filters.rememberVideoFilters", "Nhớ bộ lọc Video")
  );
  setText("stLabelUiDensity", t("settings.preferences.ui.density", "Mật độ giao diện"));
  setText("stOptDensityComfortable", t("settings.preferences.ui.densityOptions.comfortable", "Thoải mái"));
  setText("stOptDensityCompact", t("settings.preferences.ui.densityOptions.compact", "Gọn"));

  setValue("stDisplayName", safe.profile.displayName || "");
  setValue("stTagline", safe.profile.tagline || "");
  setValue("stMissionDefault", safe.profile.missionDefault || "");

  setValue("stNextActionsMax", String(safe.preferences.dashboard.nextActionsMax ?? 3));
  setValue("stDeadlineWindowHours", String(safe.preferences.dashboard.deadlineWindowHours ?? 72));
  setSelectValue("stStartRoute", safe.preferences.dashboard.startRoute, "dashboard");

  setSelectValue("stMonthMode", safe.preferences.filters.monthMode, "current");
  setChecked("stRememberExpenseFilters", safe.preferences.filters.rememberExpenseFilters);
  setChecked("stRememberIncomeFilters", safe.preferences.filters.rememberIncomeFilters);
  setChecked("stRememberVideoFilters", safe.preferences.filters.rememberVideoFilters);
  setSelectValue("stUiDensity", safe.preferences.ui.density, "comfortable");

  renderSettingsSaveState(saveState);
}

function emitFieldPatch(target, onPatch, immediate = false) {
  if (!target?.id || typeof onPatch !== "function") return;
  const builder = FIELD_PATCHERS[target.id];
  if (!builder) return;
  onPatch(builder(target), {
    source: "settings-ui",
    immediate,
  });
}

export function bindSettingsEvents({ onPatch } = {}) {
  if (_eventsBound) return;

  const root = byId("settings");
  if (!root) return;

  _eventsBound = true;

  root.addEventListener("input", (e) => {
    const target = e.target;
    if (!target?.id) return;
    if (!TEXT_IDS.includes(target.id) && target.type !== "number") return;
    emitFieldPatch(target, onPatch, false);
  });

  root.addEventListener("change", (e) => {
    const target = e.target;
    if (!target?.id) return;
    emitFieldPatch(target, onPatch, false);
  });

  root.addEventListener(
    "blur",
    (e) => {
      const target = e.target;
      if (!target?.id || !IMMEDIATE_SAVE_IDS.has(target.id)) return;
      emitFieldPatch(target, onPatch, true);
    },
    true
  );
}
