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

function goalProgress(goal) {
  const target = Math.max(1, safeNum(goal?.targetValue));
  const current = Math.max(0, safeNum(goal?.currentValue));
  const percent = Math.min(100, Math.round((current / target) * 100));
  return { target, current, percent };
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

export function renderGoalsDailyFocus(container, habits = [], habitProgressPayload = {}) {
  if (!container) return;

  const progressMap = normalizeHabitProgress(habits, habitProgressPayload);
  const focusItems = (Array.isArray(habits) ? habits : [])
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
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 4);

  if (!focusItems.length) {
    container.innerHTML = `<div class="text-muted small">${t(
      "goals.dailyFocus.empty",
      "Tuyệt vời! Bạn đã hoàn thành toàn bộ quota kỳ hiện tại."
    )}</div>`;
    return;
  }

  container.innerHTML = focusItems
    .map(({ habit, done, target, remaining, locked }) => {
      const remainingLabel = formatTemplate(t("goals.dailyFocus.remaining", "Còn {{remaining}} lượt"), {
        remaining,
      });
      const habitId = safeText(habit?.id);
      const title = escapeHtml(safeText(habit?.name, "(Không tên)"));
      const periodLabel = PERIOD_LABEL[habit?.period] || "Ngày";
      const disabled = locked || !habitId;

      return `
        <article class="daily-focus-item" data-id="${escapeHtml(habitId)}">
          <div class="daily-focus-main">
            <div class="daily-focus-title">${title}</div>
            <div class="daily-focus-meta">${periodLabel} • ${done}/${target}</div>
            <div class="daily-focus-remaining">${remainingLabel}</div>
          </div>
          <button
            class="btn btn-sm ${disabled ? "btn-success" : "btn-primary"} btn-habit-focus-checkin"
            data-id="${escapeHtml(habitId)}"
            ${disabled ? "disabled" : ""}
          >
            ${disabled ? t("goals.status.reached", "Đã đạt") : t("goals.dailyFocus.action", "Điểm danh nhanh")}
          </button>
        </article>
      `;
    })
    .join("");
}

export function renderGoalsTable(tbody, goals = []) {
  if (!tbody) return;
  const safeGoals = Array.isArray(goals) ? goals : [];

  if (!safeGoals.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">${t(
      "goals.table.emptyGoals",
      "Chưa có mục tiêu nào."
    )}</td></tr>`;
    return;
  }

  tbody.innerHTML = safeGoals
    .map((goal) => {
      const progress = goalProgress(goal);
      const isDone = goal.status === "done" || progress.current >= progress.target;
      const hasId = !!safeText(goal?.id);
      const lockAttrs = isDone || !hasId ? "disabled" : "";
      const title = escapeHtml(safeText(goal?.title, "(Không tên)"));
      const area = AREA_LABEL[goal?.area] || "Cá nhân";
      const period = PERIOD_LABEL[goal?.period] || "Tháng";
      const unit = escapeHtml(safeText(goal?.unit, "lần"));

      return `
        <tr data-id="${escapeHtml(safeText(goal?.id))}">
          <td>${title}</td>
          <td>${area}</td>
          <td>${period}</td>
          <td>
            <div class="small">${progress.current}/${progress.target} ${unit} (${progress.percent}%)</div>
            <div class="progress mt-1" style="height:6px">
              <div class="progress-bar ${isDone ? "bg-success" : ""}" role="progressbar" style="width:${progress.percent}%"></div>
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
          <td>${statusBadge(isDone)}</td>
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
      const isDone = goal.status === "done" || progress.current >= progress.target;
      const right = isDone
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
