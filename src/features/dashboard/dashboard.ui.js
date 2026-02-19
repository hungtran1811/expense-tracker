import { formatVND } from "../../shared/ui/core.js";
import { t } from "../../shared/constants/copy.vi.js";

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

function renderPriorityList(items = []) {
  if (!Array.isArray(items) || !items.length) {
    setHtml(
      "dashPriorityList",
      `<div class="text-muted small">${t(
        "dashboard.priority.empty",
        "Bạn đang đi đúng nhịp. Không có việc gấp cần xử lý ngay."
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

export function renderDashboardCommandCenter(vm) {
  if (!vm) return;

  setText("dashGreeting", vm?.hero?.greeting || "");
  setText("dashHeroTagline", vm?.hero?.tagline || "");
  setText("dashMissionTitle", vm?.hero?.missionTitle || "");
  setText("dashMissionText", vm?.hero?.missionText || "");
  setText("dashHeroMeta", vm?.hero?.meta || "");

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
