import { formatTemplate, t } from "../../shared/constants/copy.vi.js";

export const VIDEO_FILTER_STORAGE_KEY = "nexus_video_filters_v1";

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

function toDeadlineLabel(rawValue) {
  if (!rawValue) return t("videoPlan.form.noDeadline", "Không hạn");
  const dt = rawValue?.seconds ? new Date(rawValue.seconds * 1000) : new Date(rawValue);
  return Number.isNaN(dt.getTime()) ? t("videoPlan.form.noDeadline", "Không hạn") : dt.toLocaleDateString("vi-VN");
}

export function createDefaultVideoFilters() {
  return {
    stage: "all",
    priority: "all",
    query: "",
  };
}

export function normalizeVideoFilters(filters = {}) {
  const base = createDefaultVideoFilters();
  const stage = String(filters.stage || base.stage);
  const priority = String(filters.priority || base.priority);
  const query = String(filters.query || "").trim();

  return {
    stage: stage === "all" || VIDEO_STAGES.includes(stage) ? stage : base.stage,
    priority: ["all", "low", "medium", "high"].includes(priority) ? priority : base.priority,
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
  const queryEl = document.getElementById("videoFilterQuery");

  if (stageEl) stageEl.value = safe.stage;
  if (priorityEl) priorityEl.value = safe.priority;
  if (queryEl) queryEl.value = safe.query;
}

export function readVideoFiltersFromControls(current = {}) {
  const stageEl = document.getElementById("videoFilterStage");
  const priorityEl = document.getElementById("videoFilterPriority");
  const queryEl = document.getElementById("videoFilterQuery");

  return normalizeVideoFilters({
    stage: stageEl?.value || current.stage || "all",
    priority: priorityEl?.value || current.priority || "all",
    query: queryEl?.value || current.query || "",
  });
}

export function filterVideoTasks(tasks = [], filters = {}) {
  const safe = normalizeVideoFilters(filters);
  const keyword = safe.query.toLowerCase();

  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    const okStage = safe.stage === "all" ? true : task.stage === safe.stage;
    const okPriority = safe.priority === "all" ? true : task.priority === safe.priority;

    if (!keyword) return okStage && okPriority;

    const title = String(task.title || "").toLowerCase();
    const note = String(task.note || "").toLowerCase();
    const shotList = String(task.shotList || "").toLowerCase();
    return okStage && okPriority && (title.includes(keyword) || note.includes(keyword) || shotList.includes(keyword));
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

    const html = grouped[stage]
      .map((task) => {
        const taskId = safeText(task?.id);
        const priority = safeText(task?.priority, "medium");
        const title = escapeHtml(safeText(task?.title, "(Không tên)"));
        const note = escapeHtml(safeText(task?.note, t("videoPlan.form.noNote", "Không có ghi chú")));
        const deadline = toDeadlineLabel(task?.deadline);

        return `
          <article class="video-card" draggable="true" data-id="${escapeHtml(taskId)}" data-stage="${stage}">
            <header class="video-card-head">
              <strong>${title}</strong>
              <span class="badge text-bg-light">${PRIORITY_LABEL[priority] || "Vừa"}</span>
            </header>
            <div class="small text-muted">Hạn: ${escapeHtml(deadline)}</div>
            <div class="small text-muted mt-1">${note}</div>
            <div class="video-card-actions mt-2">
              <button class="btn btn-sm btn-outline-secondary btn-video-edit" ${taskId ? "" : "disabled"}>Sửa</button>
              <button class="btn btn-sm btn-outline-danger btn-video-del">Xóa</button>
            </div>
          </article>
        `;
      })
      .join("");

    col.innerHTML = html || `<div class="text-muted small">${t("videoPlan.form.emptyBoard", "Chưa có công việc phù hợp bộ lọc.")}</div>`;
  });
}

export function renderVideoSummary(container, tasks = []) {
  if (!container) return;
  const safeTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => task && typeof task === "object");

  const upcoming = safeTasks
    .filter((task) => task.status !== "done")
    .slice(0, 4)
    .map((task) => {
      const stage = VIDEO_STAGE_LABEL[task.stage] || "Ý tưởng";
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
