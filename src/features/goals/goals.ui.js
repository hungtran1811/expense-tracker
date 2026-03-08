import { formatTemplate, t } from "../../shared/constants/copy.vi.js";

function safeNum(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
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

const PERIOD_LABEL = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

const AREA_LABEL = {
  "ca-nhan": "Cá nhân",
  "tai-chinh": "Tài chính",
  youtube: "YouTube",
  "suc-khoe": "Sức khỏe",
};

function goalProgress(goal = {}) {
  const rawTarget = Number(goal?.targetValue || 0);
  const target = Math.max(1, safeNum(goal?.targetValue || 1));
  const current = Math.max(0, safeNum(goal?.currentValue));
  const percent = Math.min(100, Math.round((current / target) * 100));
  const isDone = goal?.status === "done" || (rawTarget > 0 && current >= rawTarget);
  return { target, current, percent, isDone };
}

function normalizeHabitProgress(habits, payload) {
  if (Array.isArray(payload)) {
    const todayMap = new Map(
      payload
        .filter((log) => log?.habitId)
        .map((log) => [String(log.habitId), Number(log.count || 0)])
    );
    const map = {};
    (Array.isArray(habits) ? habits : []).forEach((habit) => {
      const habitId = safeText(habit?.id);
      if (!habitId) return;
      const target = Math.max(1, Number(habit?.targetCount || 1));
      const done = todayMap.get(habitId) || 0;
      map[habitId] = {
        done,
        target,
        remaining: Math.max(0, target - done),
        locked: done >= target,
      };
    });
    return map;
  }

  return payload && typeof payload === "object" ? payload : {};
}

function statusBadge(done, activeLabel = t("goals.status.active", "Đang chạy")) {
  return done
    ? `<span class="badge status-badge status-done">${t("goals.status.done", "Hoàn thành")}</span>`
    : `<span class="badge status-badge status-active">${activeLabel}</span>`;
}

function toDateLabel(rawValue) {
  if (!rawValue) return "";
  const dt = rawValue?.seconds ? new Date(rawValue.seconds * 1000) : new Date(rawValue);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("vi-VN");
}

function toUpdatedLabel(goal = {}) {
  const updated = toDateLabel(goal?.updatedAt || goal?.createdAt || null);
  if (!updated) return "";
  return formatTemplate(t("goals.completed.updatedAt", "Cập nhật gần nhất {{date}}"), {
    date: updated,
  });
}

export function renderGoalsSummaryStrip(container, overview = {}) {
  if (!container) return;

  const activeCount = Number(overview?.activeCount || 0);
  const completedCount = Number(overview?.completedCount || 0);
  const nearCompleteCount = Number(overview?.nearCompleteCount || 0);
  const motivationLine = safeText(
    overview?.motivationLine,
    "Chưa có mục tiêu đang chạy. Tạo một mục tiêu mới để bắt đầu."
  );

  container.innerHTML = `
    <div class="goals-summary-grid">
      <article class="goals-summary-card">
        <span class="goals-summary-label">Đang chạy</span>
        <strong class="goals-summary-value">${activeCount}</strong>
      </article>
      <article class="goals-summary-card">
        <span class="goals-summary-label">Đã xong</span>
        <strong class="goals-summary-value">${completedCount}</strong>
      </article>
      <article class="goals-summary-card">
        <span class="goals-summary-label">Gần chạm đích</span>
        <strong class="goals-summary-value">${nearCompleteCount}</strong>
      </article>
    </div>
    <div class="goals-summary-message">${escapeHtml(motivationLine)}</div>
  `;
}

export function renderGoalsEmptyState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="goals-empty-state">
      <strong>Chưa có mục tiêu đang chạy.</strong>
      <p class="small text-muted mb-3">Tạo một mục tiêu mới để bắt đầu và cập nhật tiến độ từ đây.</p>
      <button class="btn btn-primary btn-sm" type="button" data-goal-open-composer="1">
        Thêm mục tiêu
      </button>
    </div>
  `;
}

export function renderGoalsSupportHabits(container, habits = [], habitProgressPayload = {}) {
  if (!container) return;

  const progressMap = normalizeHabitProgress(habits, habitProgressPayload);
  const supportItems = (Array.isArray(habits) ? habits : [])
    .map((habit) => {
      const progress = progressMap[habit.id] || {};
      const target = Math.max(1, Number(progress.target || habit.targetCount || 1));
      const done = Math.max(0, Number(progress.done || 0));
      const remaining = Math.max(0, Number(progress.remaining ?? target - done));
      const locked = !!progress.locked || done >= target;
      return {
        habit,
        target,
        done,
        remaining,
        locked,
      };
    })
    .filter((item) => item.remaining > 0)
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      if (b.target !== a.target) return b.target - a.target;
      return String(a.habit?.name || "").localeCompare(String(b.habit?.name || ""), "vi");
    })
    .slice(0, 3);

  if (!supportItems.length) {
    container.innerHTML = `
      <div class="goals-support-empty">
        <p class="small text-muted mb-3">Chưa có thói quen hỗ trợ nào cần check-in lúc này.</p>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-goal-open-advanced="1">
          Mở Nâng cao để thêm thói quen
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="goals-support-list">
      ${supportItems
        .map(({ habit, done, target, remaining, locked }) => {
          const habitId = safeText(habit?.id);
          const title = escapeHtml(safeText(habit?.name, "(Không tên)"));
          const periodLabel = PERIOD_LABEL[habit?.period] || "Ngày";
          return `
            <article class="goals-support-item" data-id="${escapeHtml(habitId)}">
              <div class="goals-support-main">
                <strong>${title}</strong>
                <div class="small text-muted">${periodLabel} • ${done}/${target} • Còn ${remaining} lượt</div>
              </div>
              <button
                class="btn btn-sm ${locked ? "btn-success" : "btn-primary"} btn-habit-focus-checkin"
                data-id="${escapeHtml(habitId)}"
                ${locked || !habitId ? "disabled" : ""}
              >
                ${locked ? "Đã đạt" : "Điểm danh nhanh"}
              </button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderGoalsDailyFocus(container, habits = [], habitProgressPayload = {}) {
  renderGoalsSupportHabits(container, habits, habitProgressPayload);
}

export function renderGoalsTable(tbody, goals = [], options = {}) {
  if (!tbody) return;

  const mode = String(options?.mode || "active").trim() === "completed" ? "completed" : "active";
  const safeGoals = Array.isArray(goals) ? goals : [];

  if (!safeGoals.length) {
    const message =
      mode === "completed" ? "Chưa có mục tiêu nào hoàn thành." : "Chưa có mục tiêu nào đang chạy.";
    const cols = mode === "completed" ? 3 : 4;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted py-3">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = safeGoals
    .map((goal) => {
      const progress = goalProgress(goal);
      const goalId = safeText(goal?.id);
      const title = escapeHtml(safeText(goal?.title, "(Không tên)"));
      const period = PERIOD_LABEL[goal?.period] || "Tháng";
      const unit = escapeHtml(safeText(goal?.unit, "lần"));
      const dueLabel = toDateLabel(goal?.dueDate);

      if (mode === "completed") {
        return `
          <tr data-id="${escapeHtml(goalId)}">
            <td>
              <div class="goal-table-title">${title}</div>
              <div class="goal-meta-list">
                <span class="badge text-bg-light">${period}</span>
                ${dueLabel ? `<span class="small text-muted">Hạn ${escapeHtml(dueLabel)}</span>` : ""}
              </div>
            </td>
            <td>
              <div class="goal-progress-stack">
                <div class="small">${progress.current}/${progress.target} ${unit} • ${progress.percent}%</div>
                <div class="goal-completed-note">${escapeHtml(toUpdatedLabel(goal))}</div>
              </div>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-danger btn-goal-del">Xóa</button>
            </td>
          </tr>
        `;
      }

      const lockAttrs = progress.isDone || !goalId ? "disabled" : "";
      return `
        <tr data-id="${escapeHtml(goalId)}">
          <td>
            <div class="goal-table-title">${title}</div>
            <div class="goal-meta-list">
              <span class="badge text-bg-light">${period}</span>
              ${dueLabel ? `<span class="small text-muted">Hạn ${escapeHtml(dueLabel)}</span>` : ""}
            </div>
          </td>
          <td>
            <div class="goal-progress-stack">
              <div class="small">${progress.current}/${progress.target} ${unit} • ${progress.percent}%</div>
              <div class="progress mt-1" style="height: 6px">
                <div class="progress-bar ${progress.isDone ? "bg-success" : ""}" role="progressbar" style="width:${progress.percent}%"></div>
              </div>
            </div>
          </td>
          <td>
            <input
              type="number"
              min="0"
              class="form-control form-control-sm goal-current-input"
              value="${progress.current}"
              ${lockAttrs}
            />
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-goal-save" ${lockAttrs}>Lưu</button>
              <button class="btn btn-outline-success btn-goal-done" ${lockAttrs}>Xong</button>
              <button class="btn btn-outline-danger btn-goal-del">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderHabitsTable(tbody, habits = [], habitProgressPayload = {}) {
  if (!tbody) return;

  const safeHabits = Array.isArray(habits) ? habits : [];
  const habitProgress = normalizeHabitProgress(safeHabits, habitProgressPayload);

  if (!safeHabits.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">${t(
      "goals.table.emptyHabits",
      "Chưa có thói quen nào."
    )}</td></tr>`;
    return;
  }

  tbody.innerHTML = safeHabits
    .map((habit) => {
      const habitId = safeText(habit?.id);
      const progress = habitProgress[habitId] || {
        done: 0,
        target: Math.max(1, Number(habit.targetCount || 1)),
        remaining: Math.max(0, Number(habit.targetCount || 1)),
        locked: false,
      };

      const target = Math.max(1, Number(progress.target || habit.targetCount || 1));
      const done = Math.max(0, Number(progress.done || 0));
      const locked = !!progress.locked || done >= target || !habitId;
      const title = escapeHtml(safeText(habit?.name, "(Không tên)"));
      const period = PERIOD_LABEL[habit?.period] || "Ngày";

      return `
        <tr data-id="${escapeHtml(habitId)}">
          <td>${title}</td>
          <td>${period}</td>
          <td>${target}</td>
          <td>${done}/${target}</td>
          <td>${statusBadge(locked)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn ${locked ? "btn-success" : "btn-outline-primary"} btn-habit-checkin" ${
                locked ? "disabled" : ""
              }>
                ${locked ? t("goals.status.reached", "Đã đạt") : t("cta.checkIn", "Điểm danh")}
              </button>
              <button class="btn btn-outline-danger btn-habit-del">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderGoalsSummary(container, goals = []) {
  if (!container) return;
  const safeGoals = Array.isArray(goals) ? goals : [];

  const active = safeGoals
    .filter((goal) => goal.status !== "archived")
    .slice(0, 3)
    .map((goal) => {
      const progress = goalProgress(goal);
      const right = progress.isDone
        ? `<span class="badge status-badge status-done">${t("goals.status.done", "Hoàn thành")}</span>`
        : `<span class="badge status-badge status-active">${progress.percent}%</span>`;

      return `<li class="list-group-item d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${escapeHtml(safeText(goal?.title, "(Không tên)"))}</div>
          <div class="small text-muted">${safeNum(goal?.currentValue)}/${safeNum(goal?.targetValue)} ${escapeHtml(
        safeText(goal?.unit, "lần")
      )}</div>
        </div>
        ${right}
      </li>`;
    });

  container.innerHTML = active.length
    ? `<ul class="list-group list-group-flush">${active.join("")}</ul>`
    : `<div class="text-muted small">${t("emptyState.goals", "Chưa có mục tiêu đang chạy.")}</div>`;
}
