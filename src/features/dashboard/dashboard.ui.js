import { formatVND } from "../../shared/ui/core.js";
import { formatTemplate, t } from "../../shared/constants/copy.vi.js";

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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setButtonState(id, { text = "", hidden = false, disabled = false, dataset = {} } = {}) {
  const btn = document.getElementById(id);
  if (!btn) return;

  btn.textContent = text;
  btn.disabled = !!disabled;
  btn.classList.toggle("d-none", !!hidden);

  Object.entries(dataset).forEach(([k, v]) => {
    if (v == null || v === "") {
      delete btn.dataset[k];
      return;
    }
    btn.dataset[k] = String(v);
  });
}

function renderPriorityList(items = []) {
  if (!Array.isArray(items) || !items.length) {
    setHtml(
      "dashPriorityList",
      `<div class="text-muted small">${t(
      "dashboard.priority.empty",
        "Không có việc gấp cần xử lý ngay."
      )}</div>`
    );
    return;
  }

  setHtml(
    "dashPriorityList",
    items
      .map((item) => {
        const itemId = safeText(item?.id);
        const title = escapeHtml(safeText(item?.title, "(Không tên)"));
        const meta = escapeHtml(safeText(item?.meta));
        if (item.type === "habit") {
          return `
            <article class="dash-priority-item">
              <div class="dash-priority-main">
                <div class="dash-priority-title">${title}</div>
                <div class="dash-priority-meta">${meta}</div>
              </div>
              <button
                class="btn btn-sm btn-outline-primary btn-dash-priority-checkin"
                data-priority-type="habit"
                data-priority-id="${escapeHtml(itemId)}"
                ${itemId ? "" : "disabled"}
              >
                ${item.actionLabel || t("dashboard.priority.actionCheckIn", "Điểm danh")}
              </button>
            </article>
          `;
        }

        return `
          <article class="dash-priority-item">
            <div class="dash-priority-main">
              <div class="dash-priority-title">${title}</div>
              <div class="dash-priority-meta">${meta}</div>
            </div>
            <a class="btn btn-sm btn-outline-primary" href="#video-plan">
              ${item.actionLabel || t("dashboard.priority.actionOpenVideo", "Mở bảng video")}
            </a>
          </article>
        `;
      })
      .join("")
  );
}

function renderAccountBalances(items = []) {
  if (!Array.isArray(items) || !items.length) {
    setHtml(
      "dashboardAccountBalances",
      `<div class="text-muted small">${t("dashboard.modules.accounts.empty", "Chưa có dữ liệu số dư tài khoản.")}</div>`
    );
    return;
  }

  setHtml(
    "dashboardAccountBalances",
    items
      .map((item) => {
        const balance = Number(item?.balance || 0);
        const cls = balance >= 0 ? "text-success" : "text-danger";
        const name = escapeHtml(safeText(item?.name, "(Không rõ)"));
        return `
          <div class="dash-balance-row">
            <span>${name}</span>
            <strong class="${cls}">${formatVND(balance)}</strong>
          </div>
        `;
      })
      .join("")
  );
}

function renderNextActions(items = []) {
  if (!Array.isArray(items) || !items.length) {
    setHtml(
      "dashNextActions",
      `<div class="text-muted small">${t("dashboard.actionBoard.emptyNext", "Không còn việc ưu tiên cần xử lý ngay.")}</div>`
    );
    return;
  }

  setHtml(
    "dashNextActions",
    items
      .map((item) => {
        const itemId = safeText(item?.id);
        const badgeClass = item?.type === "habit" ? "text-bg-success" : "text-bg-primary";
        const actionClass = item?.type === "habit" ? "btn-dash-next-checkin" : "btn-dash-next-open-video";
        const disabled = itemId ? "" : "disabled";

        return `
          <article class="dash-action-item">
            <div class="dash-action-main">
              <div class="dash-action-title-wrap">
                <span class="badge ${badgeClass}">${escapeHtml(safeText(item?.badge))}</span>
                <strong class="dash-action-title">${escapeHtml(safeText(item?.title, "(Không tên)"))}</strong>
              </div>
              <div class="dash-action-meta">${escapeHtml(safeText(item?.meta))}</div>
            </div>
            <button
              class="btn btn-sm btn-outline-primary ${actionClass}"
              data-id="${escapeHtml(itemId)}"
              ${disabled}
            >
              ${escapeHtml(safeText(item?.actionLabel, t("dashboard.nextAction.actionOpenBoard", "Mở bảng")))}
            </button>
          </article>
        `;
      })
      .join("")
  );
}

function renderDeadline72h(items = [], windowHours = 72) {
  if (!Array.isArray(items) || !items.length) {
    setHtml(
      "dashDeadline72h",
      `<div class="text-muted small">${formatTemplate(
        t("dashboard.actionBoard.emptyDeadline", "Không có task video cận hạn trong {{hours}} giờ tới."),
        { hours: Number(windowHours || 72) }
      )}</div>`
    );
    return;
  }

  setHtml(
    "dashDeadline72h",
    items
      .map((item) => {
        const itemId = safeText(item?.id);
        const dueLabel = t("dashboard.deadline.dueLabel", "Hạn {{dueDate}}").replace(
          "{{dueDate}}",
          safeText(item?.dueDate, "--/--")
        );
        const stageLabel = t("dashboard.deadline.stageLabel", "Giai đoạn: {{stage}}").replace(
          "{{stage}}",
          safeText(item?.stageLabel, "Ý tưởng")
        );

        return `
          <article class="dash-deadline-item">
            <div class="dash-deadline-main">
              <strong>${escapeHtml(safeText(item?.title, "(Không tên)"))}</strong>
              <div class="dash-deadline-meta">${escapeHtml(dueLabel)} • ${escapeHtml(stageLabel)}</div>
            </div>
            <button
              class="btn btn-sm btn-outline-primary btn-dash-next-open-video"
              data-id="${escapeHtml(itemId)}"
              ${itemId ? "" : "disabled"}
            >
              ${t("dashboard.nextAction.actionOpenVideo", "Mở task")}
            </button>
          </article>
        `;
      })
      .join("")
  );
}

export function renderDashboardActionBoard(vm) {
  setText("dashActionBoardTitle", vm?.title || t("dashboard.actionBoard.title", "Bảng hành động hôm nay"));
  setText("dashActionBoardSub", vm?.subtitle || "");
  setText("dashNextActionsTitle", vm?.nextTitle || t("dashboard.actionBoard.nextTitle", "Việc kế tiếp"));
  setText("dashDeadline72hTitle", vm?.deadlineTitle || t("dashboard.actionBoard.deadlineTitle", "Cận hạn 72 giờ"));
  setText("dashActionSummaryTitle", vm?.summaryTitle || t("dashboard.actionBoard.summaryTitle", "Tóm tắt hành động"));
  setText("dashActionSummary", vm?.summaryText || "");

  renderNextActions(vm?.nextActions || []);
  renderDeadline72h(vm?.deadlineItems || [], vm?.deadlineWindowHours || 72);

  setButtonState("btnDashQuickCheckIn", {
    text: t("dashboard.actionBoard.quickCheckin", "Điểm danh ngay"),
    hidden: !vm?.quickActions?.habitId,
    disabled: !vm?.quickActions?.habitId,
    dataset: { habitId: vm?.quickActions?.habitId || "" },
  });

  setButtonState("btnDashQuickDeadline", {
    text: t("dashboard.actionBoard.quickOpenDeadline", "Mở task cận hạn"),
    hidden: !vm?.quickActions?.deadlineTaskId,
    disabled: !vm?.quickActions?.deadlineTaskId,
    dataset: { taskId: vm?.quickActions?.deadlineTaskId || "" },
  });
}

export function renderDashboardCommandCenter(vm) {
  if (!vm) return;

  setText("dashGreeting", vm?.hero?.greeting || "");
  setText("dashHeroTagline", vm?.hero?.tagline || "");
  setText("dashQuickTitle", vm?.hero?.quickActionsTitle || t("dashboard.hero.quickActionsTitle", "Hành động nhanh"));
  setText("dashMissionTitle", vm?.hero?.missionTitle || "");
  setText("dashMissionText", vm?.hero?.missionText || "");
  setText("dashHeroMeta", vm?.hero?.meta || "");
  setText("dashPriorityTitle", t("dashboard.priority.title", "Ưu tiên hôm nay"));

  setText("dashHeroVideoCount", String(vm?.hero?.kpis?.openVideoTasks ?? 0));
  setText("dashHeroHabitCount", String(vm?.hero?.kpis?.remainingHabitTurns ?? 0));
  setText("dashHeroGoalCount", String(vm?.hero?.kpis?.activeGoals ?? 0));

  setText("dashVideoPipelineSub", vm?.modules?.video?.subtitle || "");
  setText("dashGoalsSub", vm?.modules?.goals?.subtitle || "");
  setText("dashMotivationSub", vm?.modules?.motivation?.subtitle || "");

  setText("dashVideoCountBadge", `${vm?.modules?.video?.count ?? 0}`);
  setText("dashGoalsCountBadge", `${vm?.modules?.goals?.count ?? 0}`);

  renderPriorityList(vm?.priorityItems || []);
  renderAccountBalances(vm?.modules?.accounts?.items || []);
}
