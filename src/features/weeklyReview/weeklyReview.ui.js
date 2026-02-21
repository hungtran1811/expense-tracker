import { formatVND } from "../../shared/ui/core.js";
import { formatTemplate, t } from "../../shared/constants/copy.vi.js";

let _eventsBound = false;

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

function formatDateTime(value) {
  const date = value instanceof Date ? value : value?.seconds ? new Date(value.seconds * 1000) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      ${row(t("weeklyReview.finance.transfer"), formatVND(snapshot?.totalTransfer || 0))}
      ${row(
        t("weeklyReview.finance.transactions"),
        `${Number(snapshot?.expenseCount || 0) + Number(snapshot?.incomeCount || 0)}`
      )}
    </div>
  `;
}

function renderGoalsSnapshot(snapshot = {}) {
  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.goals.active"), `${Number(snapshot?.activeGoals || 0)}`)}
      ${row(t("weeklyReview.goals.done"), `${Number(snapshot?.doneGoals || 0)}`)}
      ${row(t("weeklyReview.goals.habitsTotal"), `${Number(snapshot?.habitsTotal || 0)}`)}
      ${row(t("weeklyReview.goals.habitsReached"), `${Number(snapshot?.habitsReached || 0)}`)}
      ${row(t("weeklyReview.goals.checkins"), `${Number(snapshot?.checkins || 0)}`)}
    </div>
  `;
}

function renderVideoSnapshot(snapshot = {}) {
  const deadlineWindowHours = Number(snapshot?.deadlineWindowHours || 72);
  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.video.open"), `${Number(snapshot?.open || 0)}`)}
      ${row(t("weeklyReview.video.done"), `${Number(snapshot?.done || 0)}`)}
      ${row(t("weeklyReview.video.dueWeek"), `${Number(snapshot?.dueInWeek || 0)}`)}
      ${row(
        formatTemplate(t("weeklyReview.video.dueWindow"), {
          hours: deadlineWindowHours,
        }),
        `${Number(snapshot?.dueInWindow || 0)}`
      )}
      ${row(t("weeklyReview.video.overdue"), `${Number(snapshot?.overdue || 0)}`)}
    </div>
  `;
}

function renderDetailTable(snapshot = {}, releasePlan = {}) {
  const finance = snapshot?.finance || {};
  const goals = snapshot?.goals || {};
  const video = snapshot?.video || {};
  const deadlineWindowHours = Number(video?.deadlineWindowHours || 72);
  const stageRows = Array.isArray(releasePlan?.stageRows) ? releasePlan.stageRows : [];
  const actionRows = Array.isArray(releasePlan?.actions) ? releasePlan.actions : [];

  const rows = [
    {
      group: t("weeklyReview.detail.groups.finance", "Tài chính"),
      metric: t("weeklyReview.finance.income", "Tổng thu"),
      value: formatVND(finance?.totalIncome || 0),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.finance", "Tài chính"),
      metric: t("weeklyReview.finance.expense", "Tổng chi"),
      value: formatVND(finance?.totalExpense || 0),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.finance", "Tài chính"),
      metric: t("weeklyReview.finance.net", "Dòng tiền ròng"),
      value: formatVND(finance?.net || 0),
      note:
        Number(finance?.net || 0) < 0
          ? t("weeklyReview.detail.notes.netNegative", "Dòng tiền âm, cần rà soát chi phí tuần tới.")
          : "",
    },
    {
      group: t("weeklyReview.detail.groups.goals", "Mục tiêu"),
      metric: t("weeklyReview.goals.active", "Mục tiêu đang chạy"),
      value: String(Number(goals?.activeGoals || 0)),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.goals", "Mục tiêu"),
      metric: t("weeklyReview.goals.done", "Mục tiêu đã hoàn thành"),
      value: String(Number(goals?.doneGoals || 0)),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.goals", "Mục tiêu"),
      metric: t("weeklyReview.goals.habitsReached", "Thói quen đạt quota"),
      value: `${Number(goals?.habitsReached || 0)}/${Number(goals?.habitsTotal || 0)}`,
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.video", "Video"),
      metric: t("weeklyReview.video.open", "Công việc đang mở"),
      value: String(Number(video?.open || 0)),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.video", "Video"),
      metric: formatTemplate(t("weeklyReview.video.dueWindow", "Công việc cận hạn {{hours}}h"), {
        hours: deadlineWindowHours,
      }),
      value: String(Number(video?.dueInWindow || 0)),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.video", "Video"),
      metric: t("weeklyReview.video.overdue", "Công việc quá hạn"),
      value: String(Number(video?.overdue || 0)),
      note:
        Number(video?.overdue || 0) > 0
          ? t("weeklyReview.detail.notes.overdue", "Ưu tiên xử lý các việc quá hạn trước.")
          : "",
    },
    {
      group: t("weeklyReview.detail.groups.release", "Release"),
      metric: t("weeklyReview.detail.stage", "Tiến độ pipeline"),
      value: stageRows.length
        ? stageRows.map((item) => `${item?.label || "-"}: ${Number(item?.count || 0)}`).join(" • ")
        : t("weeklyReview.release.emptyStage", "Chưa có dữ liệu pipeline video tuần này."),
      note: "",
    },
    {
      group: t("weeklyReview.detail.groups.release", "Release"),
      metric: t("weeklyReview.detail.actions", "Checklist ưu tiên"),
      value: actionRows.length
        ? actionRows.slice(0, 2).join(" | ")
        : t("weeklyReview.release.emptyAction", "Tuần này chưa có hạng mục ưu tiên."),
      note: "",
    },
  ];

  return `
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0 wr-detail-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("weeklyReview.detail.columns.group", "Nhóm"))}</th>
            <th>${escapeHtml(t("weeklyReview.detail.columns.metric", "Chỉ số"))}</th>
            <th class="text-end">${escapeHtml(t("weeklyReview.detail.columns.value", "Giá trị"))}</th>
            <th>${escapeHtml(t("weeklyReview.detail.columns.note", "Ghi chú hành động"))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (item) => `
            <tr>
              <td class="wr-detail-group">${escapeHtml(item.group)}</td>
              <td>${escapeHtml(item.metric)}</td>
              <td class="text-end fw-semibold">${escapeHtml(item.value)}</td>
              <td class="text-muted">${escapeHtml(item.note || "-")}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReleaseStage(releasePlan = {}) {
  const rows = Array.isArray(releasePlan?.stageRows) ? releasePlan.stageRows : [];
  if (!rows.length) {
    return `<div class="text-muted small">${escapeHtml(
      t("weeklyReview.release.emptyStage", "Chưa có dữ liệu pipeline video tuần này.")
    )}</div>`;
  }

  return `
    <div class="wr-metric-list">
      ${rows
        .map((item) =>
          row(
            String(item?.label || "").trim() || t("weeklyReview.release.stageFallback", "Giai đoạn"),
            `${Number(item?.count || 0)}`
          )
        )
        .join("")}
    </div>
  `;
}

function renderHistoryList(history = [], currentWeekKey = "") {
  if (!Array.isArray(history) || !history.length) {
    return `<div class="text-muted small">${escapeHtml(
      t("weeklyReview.history.empty")
    )}</div>`;
  }

  return `
    <div class="wr-history-list">
      ${history
        .map((item) => {
          const weekKey = String(item?.weekKey || "").trim();
          if (!weekKey) return "";

          const activeClass = weekKey === currentWeekKey ? "active" : "";
          const updatedAt = formatDateTime(item?.updatedAt);
          const note = updatedAt
            ? t("weeklyReview.history.savedReview")
            : t("weeklyReview.history.pendingReview");

          return `
            <button type="button" class="wr-history-item ${activeClass}" data-week-key="${escapeHtml(weekKey)}">
              <div class="wr-history-top">
                <strong>${escapeHtml(weekKey)}</strong>
                ${updatedAt ? `<span>${escapeHtml(updatedAt)}</span>` : ""}
              </div>
              <div class="wr-history-note">${escapeHtml(note)}</div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderWeeklyReviewPage(vm) {
  setText("wrHeaderTitle", t("weeklyReview.header.title"));
  setText("wrHeaderSubtitle", t("weeklyReview.header.subtitle"));
  setText("wrFinanceTitle", t("weeklyReview.cards.finance"));
  setText("wrGoalsTitle", t("weeklyReview.cards.goals"));
  setText("wrVideoTitle", t("weeklyReview.cards.video"));
  setText("wrDetailTitle", t("weeklyReview.cards.detail", "Bảng tổng kết chi tiết"));
  setText("wrReleaseStageTitle", t("weeklyReview.cards.releaseStage"));
  setText("wrHistoryTitle", t("weeklyReview.history.title"));

  setText("wrWeekLabel", vm?.weekLabel || t("weeklyReview.header.fallbackWeek"));

  setHtml("wrFinanceSnapshot", renderFinanceSnapshot(vm?.snapshot?.finance || {}));
  setHtml("wrGoalsSnapshot", renderGoalsSnapshot(vm?.snapshot?.goals || {}));
  setHtml("wrVideoSnapshot", renderVideoSnapshot(vm?.snapshot?.video || {}));
  setHtml("wrDetailTable", renderDetailTable(vm?.snapshot || {}, vm?.releasePlan || {}));
  setHtml("wrReleaseStage", renderReleaseStage(vm?.releasePlan || {}));
  setHtml("wrHistoryList", renderHistoryList(vm?.history || [], vm?.weekKey || ""));
}

export function bindWeeklyReviewEvents({ onOpenHistory } = {}) {
  if (_eventsBound) return;

  const root = byId("weekly-review");
  if (!root) return;
  _eventsBound = true;

  byId("wrHistoryList")?.addEventListener("click", (e) => {
    if (typeof onOpenHistory !== "function") return;
    const button = e.target.closest("[data-week-key]");
    if (!button) return;
    const weekKey = String(button.dataset.weekKey || "").trim();
    if (!weekKey) return;
    onOpenHistory(weekKey);
  });
}

