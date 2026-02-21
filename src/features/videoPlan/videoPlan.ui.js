import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import {
  asDate,
  addDays,
  parseDateKey,
  startOfMonth,
  toDateKey,
  toDateLabelVi,
  toYm,
} from "../../shared/utils/date.js";

export const VIDEO_FILTER_STORAGE_KEY = "nexus_video_filters_v1";
export const VIDEO_CALENDAR_STORAGE_KEY = "nexus_video_calendar_v1";

export const VIDEO_STAGES = ["idea", "research", "script", "shoot", "edit", "publish"];

export const VIDEO_STAGE_LABEL = {
  idea: "Ý tưởng",
  research: "Nghiên cứu",
  script: "Kịch bản",
  shoot: "Quay",
  edit: "Dựng",
  publish: "Xuất bản",
};

const PRIORITY_LABEL = {
  low: "Thấp",
  medium: "Vừa",
  high: "Cao",
};

function toMs(value) {
  if (!value) return 0;
  if (value?.seconds) return Number(value.seconds) * 1000;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function priorityClass(priority = "medium") {
  const key = String(priority || "medium").toLowerCase();
  return `priority-${["low", "medium", "high"].includes(key) ? key : "medium"}`;
}

function getStageLabel(stage = "idea") {
  const key = String(stage || "idea");
  return t(`videoPlan.stage.${key}`, VIDEO_STAGE_LABEL[key] || VIDEO_STAGE_LABEL.idea);
}

function toDeadlineLabel(rawValue) {
  if (!rawValue) return t("videoPlan.form.noDeadline", "Không hạn");
  const dt = rawValue?.seconds ? new Date(rawValue.seconds * 1000) : new Date(rawValue);
  return Number.isNaN(dt.getTime()) ? t("videoPlan.form.noDeadline", "Không hạn") : dt.toLocaleDateString("vi-VN");
}

function toDeadlineMs(rawValue) {
  if (!rawValue) return Number.POSITIVE_INFINITY;
  const dt = rawValue?.seconds ? new Date(rawValue.seconds * 1000) : new Date(rawValue);
  return Number.isNaN(dt.getTime()) ? Number.POSITIVE_INFINITY : dt.getTime();
}

function compareStageTasks(a = {}, b = {}) {
  const aDue = toDeadlineMs(a.deadline);
  const bDue = toDeadlineMs(b.deadline);
  if (aDue !== bDue) return aDue - bDue;

  const aPriority = { high: 3, medium: 2, low: 1 }[String(a.priority || "medium")] || 2;
  const bPriority = { high: 3, medium: 2, low: 1 }[String(b.priority || "medium")] || 2;
  if (aPriority !== bPriority) return bPriority - aPriority;

  const aCreated = toMs(a.createdAt);
  const bCreated = toMs(b.createdAt);
  if (aCreated !== bCreated) return bCreated - aCreated;

  return String(a.title || "").localeCompare(String(b.title || ""), "vi");
}

export function createDefaultVideoFilters() {
  return {
    stage: "all",
    priority: "all",
    retroStatus: "all",
    query: "",
  };
}

export function normalizeVideoFilters(filters = {}) {
  const base = createDefaultVideoFilters();
  const stage = String(filters.stage || base.stage);
  const priority = String(filters.priority || base.priority);
  const retroStatus = String(filters.retroStatus || base.retroStatus);
  const query = String(filters.query || "").trim();

  return {
    stage: stage === "all" || VIDEO_STAGES.includes(stage) ? stage : base.stage,
    priority: ["all", "low", "medium", "high"].includes(priority) ? priority : base.priority,
    retroStatus: ["all", "withRetro", "withoutRetro"].includes(retroStatus)
      ? retroStatus
      : base.retroStatus,
    query,
  };
}

export function loadVideoFilters() {
  try {
    const raw = localStorage.getItem(VIDEO_FILTER_STORAGE_KEY);
    if (!raw) return createDefaultVideoFilters();
    return normalizeVideoFilters(JSON.parse(raw));
  } catch {
    return createDefaultVideoFilters();
  }
}

export function saveVideoFilters(filters) {
  try {
    localStorage.setItem(VIDEO_FILTER_STORAGE_KEY, JSON.stringify(normalizeVideoFilters(filters)));
  } catch {
    // ignore storage errors
  }
}

export function hydrateVideoFilterControls(filters = {}) {
  const safe = normalizeVideoFilters(filters);
  const stageEl = document.getElementById("videoFilterStage");
  const priorityEl = document.getElementById("videoFilterPriority");
  const retroEl = document.getElementById("videoRetroFilter");
  const queryEl = document.getElementById("videoFilterQuery");

  if (stageEl) stageEl.value = safe.stage;
  if (priorityEl) priorityEl.value = safe.priority;
  if (retroEl) retroEl.value = safe.retroStatus;
  if (queryEl) queryEl.value = safe.query;
}

export function readVideoFiltersFromControls(current = {}) {
  const stageEl = document.getElementById("videoFilterStage");
  const priorityEl = document.getElementById("videoFilterPriority");
  const retroEl = document.getElementById("videoRetroFilter");
  const queryEl = document.getElementById("videoFilterQuery");

  return normalizeVideoFilters({
    stage: stageEl?.value || current.stage || "all",
    priority: priorityEl?.value || current.priority || "all",
    retroStatus: retroEl?.value || current.retroStatus || "all",
    query: queryEl?.value || current.query || "",
  });
}

export function filterVideoTasks(tasks = [], filters = {}) {
  const safe = normalizeVideoFilters(filters);
  const keyword = safe.query.toLowerCase();

  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    const okStage = safe.stage === "all" ? true : task.stage === safe.stage;
    const okPriority = safe.priority === "all" ? true : task.priority === safe.priority;
    const hasRetro = !!task?.hasRetro;
    const okRetro =
      safe.retroStatus === "all"
        ? true
        : safe.retroStatus === "withRetro"
        ? hasRetro
        : !hasRetro;

    if (!keyword) return okStage && okPriority && okRetro;

    const title = String(task.title || "").toLowerCase();
    const note = String(task.note || "").toLowerCase();
    const shotList = String(task.shotList || "").toLowerCase();
    return (
      okStage &&
      okPriority &&
      okRetro &&
      (title.includes(keyword) || note.includes(keyword) || shotList.includes(keyword))
    );
  });
}

export function renderVideoFilterSummary(container, filtered = 0, total = 0) {
  if (!container) return;
  container.textContent = formatTemplate(
    t("videoPlan.filters.summary", "{{filtered}}/{{total}} công việc đang hiển thị"),
    {
      filtered: Number(filtered || 0),
      total: Number(total || 0),
    }
  );
}

export function createDefaultVideoCalendarState(now = new Date()) {
  const safeNow = asDate(now) || new Date();
  return {
    viewMode: "board",
    selectedDate: toDateKey(safeNow),
    monthAnchor: toYm(startOfMonth(safeNow)),
  };
}

export function normalizeVideoCalendarState(value = {}, now = new Date()) {
  const base = createDefaultVideoCalendarState(now);
  const raw = value && typeof value === "object" ? value : {};
  const viewMode = raw.viewMode === "calendar" ? "calendar" : "board";
  const selectedDate = parseDateKey(raw.selectedDate) ? raw.selectedDate : base.selectedDate;
  const monthAnchor = /^\d{4}-\d{2}$/.test(String(raw.monthAnchor || "")) ? String(raw.monthAnchor) : base.monthAnchor;

  return { viewMode, selectedDate, monthAnchor };
}

export function loadVideoCalendarState(now = new Date()) {
  try {
    const raw = localStorage.getItem(VIDEO_CALENDAR_STORAGE_KEY);
    if (!raw) return createDefaultVideoCalendarState(now);
    return normalizeVideoCalendarState(JSON.parse(raw), now);
  } catch {
    return createDefaultVideoCalendarState(now);
  }
}

export function saveVideoCalendarState(state = {}) {
  try {
    localStorage.setItem(VIDEO_CALENDAR_STORAGE_KEY, JSON.stringify(normalizeVideoCalendarState(state)));
  } catch {
    // ignore storage errors
  }
}

export function renderVideoViewState(viewMode = "board") {
  const boardWrap = document.getElementById("videoPlanViewBoard");
  const calendarWrap = document.getElementById("videoPlanViewCalendar");
  const boardBtn = document.getElementById("videoViewBoard");
  const calendarBtn = document.getElementById("videoViewCalendar");
  const mode = viewMode === "calendar" ? "calendar" : "board";

  if (boardWrap) boardWrap.classList.toggle("d-none", mode !== "board");
  if (calendarWrap) calendarWrap.classList.toggle("d-none", mode !== "calendar");

  if (boardBtn) {
    boardBtn.classList.toggle("active", mode === "board");
    boardBtn.setAttribute("aria-pressed", mode === "board" ? "true" : "false");
  }
  if (calendarBtn) {
    calendarBtn.classList.toggle("active", mode === "calendar");
    calendarBtn.setAttribute("aria-pressed", mode === "calendar" ? "true" : "false");
  }
}

export function renderVideoBoard(tasks = []) {
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => task && typeof task === "object");
  const grouped = VIDEO_STAGES.reduce((acc, stage) => {
    acc[stage] = [];
    return acc;
  }, {});

  safeTasks.forEach((task) => {
    const stage = VIDEO_STAGES.includes(task.stage) ? task.stage : "idea";
    grouped[stage].push(task);
  });

  VIDEO_STAGES.forEach((stage) => {
    const col = document.getElementById(`videoCol${capitalize(stage)}`);
    if (!col) return;

    const stageLabel = getStageLabel(stage);
    const html = grouped[stage]
      .slice()
      .sort(compareStageTasks)
      .map((task) => {
        const taskId = safeText(task?.id);
        const priority = safeText(task?.priority, "medium");
        const title = escapeHtml(safeText(task?.title, "(Không tên)"));
        const note = escapeHtml(safeText(task?.note, t("videoPlan.form.noNote", "Không có ghi chú")));
        const deadline = toDeadlineLabel(task?.deadline);
        const hasRetro = !!task?.hasRetro;
        const retroBadge = hasRetro
          ? `<span class="badge text-bg-success">${t("videoPlan.retro.doneBadge", "Đã ghi kết quả")}</span>`
          : `<span class="badge text-bg-secondary">${t("videoPlan.retro.missingBadge", "Chưa ghi kết quả")}</span>`;

        return `
          <article class="video-card" draggable="true" data-id="${escapeHtml(taskId)}" data-stage="${stage}">
            <header class="video-card-head">
              <strong>${title}</strong>
              <span class="badge text-bg-light ${priorityClass(priority)}">${PRIORITY_LABEL[priority] || "Vừa"}</span>
            </header>
            <div class="video-card-meta-row small text-muted">
              <span>${t("videoPlan.form.stageLabel", "Giai đoạn")}: ${escapeHtml(stageLabel)}</span>
              <span>${t("videoPlan.form.deadlineLabel", "Hạn")}: ${escapeHtml(deadline)}</span>
            </div>
            <div class="mt-2">${retroBadge}</div>
            <div class="small text-muted video-card-note mt-2">${note}</div>
            <div class="video-card-actions mt-2">
              <button class="btn btn-sm btn-outline-primary btn-video-retro-open" ${taskId ? "" : "disabled"}>
                ${t("videoPlan.retro.openButton", "Kết quả xuất bản")}
              </button>
              <button class="btn btn-sm btn-outline-secondary btn-video-edit" ${taskId ? "" : "disabled"}>
                ${t("videoPlan.form.editAction", "Sửa nhanh")}
              </button>
              <button class="btn btn-sm btn-outline-danger btn-video-del">
                ${t("videoPlan.form.deleteAction", "Xóa")}
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    col.innerHTML = html || `<div class="text-muted small">${t("videoPlan.form.emptyBoard", "Chưa có công việc phù hợp bộ lọc.")}</div>`;
  });
}

function renderReminderLegend(vm) {
  const root = document.getElementById("videoCalendarLegend");
  if (!root) return;
  const reminders = vm?.reminders || {};
  const windowHours = Number(vm?.deadlineWindowHours || 72);

  root.innerHTML = `
    <span class="calendar-reminder-chip is-overdue">${formatTemplate(t("videoPlan.reminder.overdue", "Quá hạn: {{count}}"), {
      count: Number(reminders.overdue || 0),
    })}</span>
    <span class="calendar-reminder-chip is-today">${formatTemplate(t("videoPlan.reminder.today", "Hôm nay: {{count}}"), {
      count: Number(reminders.dueToday || 0),
    })}</span>
    <span class="calendar-reminder-chip is-soon">${formatTemplate(
      t("videoPlan.reminder.soon", "Cận hạn {{hours}}h: {{count}}"),
      {
        hours: windowHours,
        count: Number(reminders.dueSoon || 0),
      }
    )}</span>
  `;
}

function renderMonthGrid(vm) {
  const root = document.getElementById("videoCalendarGrid");
  if (!root) return;

  const cells = Array.isArray(vm?.monthDays) ? vm.monthDays : [];
  if (!cells.length) {
    root.innerHTML = `<div class="calendar-empty">${t("videoPlan.calendar.empty", "Chưa có lịch video cho tháng đang chọn.")}</div>`;
    return;
  }

  root.innerHTML = cells
    .map((item) => {
      const classes = [
        "calendar-day-cell",
        item?.isInMonth ? "" : "is-outside",
        item?.isToday ? "is-today" : "",
        item?.isSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const count = Number(item?.totalCount || 0);
      const overdueCount = Number(item?.overdueCount || 0);

      return `
        <button class="${classes}" type="button" data-date-key="${escapeHtml(safeText(item?.dateKey))}">
          <span class="calendar-day-number">${Number(item?.dayNumber || 0)}</span>
          <span class="calendar-day-meta">
            <span class="calendar-day-count">${count > 0 ? formatTemplate(t("videoPlan.calendar.count", "{{count}} việc"), { count }) : ""}</span>
            ${overdueCount > 0 ? `<span class="calendar-day-overdue">${formatTemplate(t("videoPlan.calendar.overdueCount", "Quá hạn {{count}}"), { count: overdueCount })}</span>` : ""}
          </span>
        </button>
      `;
    })
    .join("");
}

function renderWeekStrip(vm) {
  const root = document.getElementById("videoCalendarWeekStrip");
  if (!root) return;
  const week = Array.isArray(vm?.weekDays) ? vm.weekDays : [];

  if (!week.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = week
    .map((item) => {
      const classes = [
        "calendar-week-item",
        item?.isToday ? "is-today" : "",
        item?.isSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const total = Number(item?.totalCount || 0);
      return `
        <button class="${classes}" type="button" data-date-key="${escapeHtml(safeText(item?.dateKey))}">
          <span>${escapeHtml(safeText(item?.weekDayShort, ""))}</span>
          <strong>${Number(item?.dayNumber || 0)}</strong>
          <small>${total > 0 ? `${total}` : "-"}</small>
        </button>
      `;
    })
    .join("");
}

function renderAgenda(vm) {
  const root = document.getElementById("videoCalendarAgenda");
  if (!root) return;
  const list = Array.isArray(vm?.agendaItems) ? vm.agendaItems : [];

  if (!list.length) {
    root.innerHTML = `<div class="calendar-empty">${t("videoPlan.calendar.emptyDay", "Ngày này chưa có công việc video.")}</div>`;
    return;
  }

  root.innerHTML = list
    .map((item) => {
      const statusClass = item?.isOverdue ? "is-overdue" : item?.isDueToday ? "is-today" : item?.isDueSoon ? "is-soon" : "";
      return `
        <article class="calendar-agenda-item ${statusClass}" data-task-id="${escapeHtml(safeText(item?.id))}">
          <div class="calendar-agenda-main">
            <strong>${escapeHtml(safeText(item?.title, "(Không tên)"))}</strong>
            <div class="small text-muted">${escapeHtml(getStageLabel(item?.stage))} • ${escapeHtml(t(`videoPlan.priority.${item?.priority || "medium"}`, "Vừa"))}</div>
          </div>
          <button class="btn btn-sm btn-outline-primary btn-video-calendar-open" data-id="${escapeHtml(safeText(item?.id))}">
            ${t("videoPlan.calendar.openTask", "Mở công việc")}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderUnscheduled(vm) {
  const root = document.getElementById("videoUnscheduledList");
  if (!root) return;
  const list = Array.isArray(vm?.unscheduled) ? vm.unscheduled : [];
  if (!list.length) {
    root.innerHTML = `<div class="calendar-empty">${t("videoPlan.calendar.emptyUnscheduled", "Không có công việc chưa lên lịch.")}</div>`;
    return;
  }

  root.innerHTML = list
    .map((item) => {
      return `
        <article class="calendar-unscheduled-item" data-task-id="${escapeHtml(safeText(item?.id))}">
          <div class="calendar-agenda-main">
            <strong>${escapeHtml(safeText(item?.title, "(Không tên)"))}</strong>
            <div class="small text-muted">${escapeHtml(getStageLabel(item?.stage))}</div>
          </div>
          <button class="btn btn-sm btn-outline-secondary btn-video-calendar-open" data-id="${escapeHtml(safeText(item?.id))}">
            ${t("videoPlan.calendar.openTask", "Mở công việc")}
          </button>
        </article>
      `;
    })
    .join("");
}

export function renderVideoCalendar(vm = {}) {
  const monthLabel = safeText(vm?.monthLabel, "");
  const selectedDateLabel = safeText(vm?.selectedDateLabel, "");

  const monthEl = document.getElementById("videoCalendarMonthLabel");
  if (monthEl) monthEl.textContent = monthLabel || t("videoPlan.calendar.monthFallback", "Tháng hiện tại");

  const selectedEl = document.getElementById("videoCalendarSelectedLabel");
  if (selectedEl) {
    selectedEl.textContent = selectedDateLabel
      ? formatTemplate(t("videoPlan.calendar.selectedDate", "Lịch ngày {{date}}"), { date: selectedDateLabel })
      : t("videoPlan.calendar.selectedDateFallback", "Lịch theo ngày");
  }

  renderReminderLegend(vm);
  renderWeekStrip(vm);
  renderMonthGrid(vm);
  renderAgenda(vm);
  renderUnscheduled(vm);
}

export function renderVideoSummary(container, tasks = []) {
  if (!container) return;
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => task && typeof task === "object");

  const upcoming = safeTasks
    .filter((task) => task.status !== "done")
    .slice(0, 4)
    .map((task) => {
      const stage = getStageLabel(task.stage);
      return `<li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${escapeHtml(safeText(task?.title, "(Không tên)"))}</span>
        <span class="badge text-bg-primary">${stage}</span>
      </li>`;
    });

  container.innerHTML = upcoming.length
    ? `<ul class="list-group list-group-flush">${upcoming.join("")}</ul>`
    : `<div class="text-muted small">${t("videoPlan.form.emptySummary", "Chưa có công việc video.")}</div>`;
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}
