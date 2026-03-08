import { formatVND } from "../../shared/ui/core.js";
import { t } from "../../shared/constants/copy.vi.js";

let eventsBound = false;
let handlers = {
  onFilterChange: null,
};

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value = "") {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setHtml(id, html = "") {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePeriodMode(value = "") {
  return String(value || "").trim() === "month" ? "month" : "week";
}

function normalizeWeekInput(value = "") {
  const raw = String(value || "").trim();
  return /^\d{4}-W\d{2}$/.test(raw) ? raw : "";
}

function normalizeMonthInput(value = "") {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function togglePeriodControls(mode = "week") {
  const weekInput = byId("wrWeekPicker");
  const monthInput = byId("wrMonthPicker");
  if (weekInput) weekInput.classList.toggle("d-none", mode !== "week");
  if (monthInput) monthInput.classList.toggle("d-none", mode !== "month");
}

function syncPeriodControls(vm = {}) {
  const mode = normalizePeriodMode(vm?.period?.mode || "week");
  const weekKey = normalizeWeekInput(vm?.period?.weekKey || vm?.weekKey || "");
  const monthKey = normalizeMonthInput(vm?.period?.monthKey || "");

  const modeEl = byId("wrPeriodMode");
  if (modeEl) modeEl.value = mode;

  const weekInput = byId("wrWeekPicker");
  if (weekInput) weekInput.value = weekKey;

  const monthInput = byId("wrMonthPicker");
  if (monthInput) monthInput.value = monthKey;

  togglePeriodControls(mode);
}

function row(label, value, valueClass = "") {
  return `<div class="wr-metric-row"><span>${escapeHtml(label)}</span><strong class="${escapeHtml(
    valueClass
  )}">${escapeHtml(value)}</strong></div>`;
}

function renderFinanceSnapshot(snapshot = {}) {
  const net = Number(snapshot?.net || 0);
  const netClass = net >= 0 ? "text-success" : "text-danger";

  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.finance.income"), formatVND(snapshot?.totalIncome || 0))}
      ${row(t("weeklyReview.finance.expense"), formatVND(snapshot?.totalExpense || 0))}
      ${row(t("weeklyReview.finance.net"), formatVND(net), netClass)}
    </div>
  `;
}

function renderClassesSnapshot(snapshot = {}) {
  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.classes.active", "Lớp đang dạy"), `${Number(snapshot?.activeClasses || 0)}`)}
      ${row(t("weeklyReview.classes.completed", "Lớp đã hoàn thành"), `${Number(snapshot?.completedClasses || 0)}`)}
      ${row(
        t("weeklyReview.classes.progress", "Tiến độ buổi đã dạy"),
        `${Number(snapshot?.doneSessions || 0)}/${Number(snapshot?.totalSessions || 0)} (${Number(
          snapshot?.progressRate || 0
        )}%)`
      )}
    </div>
  `;
}

function renderReleaseStage(releasePlan = {}) {
  const actions = Array.isArray(releasePlan?.actions) ? releasePlan.actions : [];
  if (!actions.length) {
    return `<div class="text-muted small">${escapeHtml(
      t("weeklyReview.release.emptyAction", "Tuần này chưa có hạng mục ưu tiên.")
    )}</div>`;
  }

  return `
    <ul class="wr-action-list mb-0">
      ${actions.map((item) => `<li>${escapeHtml(String(item || "").trim())}</li>`).join("")}
    </ul>
  `;
}

export function renderWeeklyReviewPage(vm) {
  const safeVm = vm || {};

  setText("wrHeaderTitle", t("weeklyReview.header.title"));
  setText("wrPeriodModeLabel", t("weeklyReview.filters.modeLabel", "Bộ lọc"));
  setText("wrWeekInputLabel", t("weeklyReview.filters.weekLabel", "Tuần"));
  setText("wrMonthInputLabel", t("weeklyReview.filters.monthLabel", "Tháng"));
  setText("wrFinanceTitle", t("weeklyReview.cards.finance"));
  setText("wrGoalsTitle", t("weeklyReview.cards.classes", "Lớp học"));
  setText("wrActionsTitle", t("weeklyReview.cards.actions", "Hành động ưu tiên"));

  const periodModeEl = byId("wrPeriodMode");
  if (periodModeEl && !periodModeEl.dataset.i18nApplied) {
    periodModeEl.innerHTML = `
      <option value="week">${escapeHtml(t("weeklyReview.filters.byWeek", "Theo tuần"))}</option>
      <option value="month">${escapeHtml(t("weeklyReview.filters.byMonth", "Theo tháng"))}</option>
    `;
    periodModeEl.dataset.i18nApplied = "1";
  }

  setText("wrWeekLabel", safeVm?.weekLabel || t("weeklyReview.header.fallbackWeek"));
  setHtml("wrFinanceSnapshot", renderFinanceSnapshot(safeVm?.snapshot?.finance || {}));
  setHtml("wrGoalsSnapshot", renderClassesSnapshot(safeVm?.snapshot?.classes || {}));
  setHtml("wrReleaseStage", renderReleaseStage(safeVm?.releasePlan || {}));
  syncPeriodControls(safeVm);
}

export function bindWeeklyReviewEvents({ onFilterChange } = {}) {
  handlers = {
    onFilterChange: typeof onFilterChange === "function" ? onFilterChange : null,
  };

  if (eventsBound) return;

  const root = byId("weekly-review");
  if (!root) return;
  eventsBound = true;

  const emitFilterChange = () => {
    if (typeof handlers.onFilterChange !== "function") return;
    const mode = normalizePeriodMode(byId("wrPeriodMode")?.value || "week");
    const weekKey = normalizeWeekInput(byId("wrWeekPicker")?.value || "");
    const monthKey = normalizeMonthInput(byId("wrMonthPicker")?.value || "");
    togglePeriodControls(mode);
    handlers.onFilterChange({ mode, weekKey, monthKey });
  };

  byId("wrPeriodMode")?.addEventListener("change", emitFilterChange);
  byId("wrWeekPicker")?.addEventListener("change", emitFilterChange);
  byId("wrMonthPicker")?.addEventListener("change", emitFilterChange);

  togglePeriodControls(normalizePeriodMode(byId("wrPeriodMode")?.value || "week"));
}
