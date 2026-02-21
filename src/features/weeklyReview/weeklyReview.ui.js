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

function renderVideoPerformanceSnapshot(snapshot = {}) {
  const published = Number(snapshot?.videosPublished || 0);
  if (!published) {
    return `<div class="text-muted small">${escapeHtml(
      t("weeklyReview.videoPerformance.noData")
    )}</div>`;
  }

  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.videoPerformance.published"), `${published}`)}
      ${row(t("weeklyReview.videoPerformance.totalViews"), `${Number(snapshot?.totalViews || 0)}`)}
      ${row(t("weeklyReview.videoPerformance.avgCtr"), `${Number(snapshot?.avgCtr || 0)}%`)}
      ${row(
        t("weeklyReview.videoPerformance.avgRetention30s"),
        `${Number(snapshot?.avgRetention30s || 0)}%`
      )}
      ${row(t("weeklyReview.videoPerformance.avgDuration"), `${Number(snapshot?.avgDurationSec || 0)}s`)}
    </div>
  `;
}

function renderMotivationSnapshot(snapshot = {}) {
  return `
    <div class="wr-metric-list">
      ${row(t("weeklyReview.motivation.streak"), `${Number(snapshot?.streak || 0)}`)}
      ${row(t("weeklyReview.motivation.totalXp"), `${Number(snapshot?.totalXp || 0)}`)}
      ${row(t("weeklyReview.motivation.level"), `${Number(snapshot?.level || 1)}`)}
      ${row(t("weeklyReview.motivation.weekXp"), `${Number(snapshot?.weekXp || 0)}`)}
      ${row(
        t("weeklyReview.motivation.challengeWeek"),
        `${Number(snapshot?.weekProgress?.done || 0)}/${Number(snapshot?.weekProgress?.target || 0)} (${Number(
          snapshot?.weekProgress?.percent || 0
        )}%)`
      )}
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
          const note = item?.hasPlan
            ? t("weeklyReview.history.hasPlan")
            : t("weeklyReview.history.noPlan");

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

function statusClass(status = "idle") {
  if (status === "saving") return "text-primary";
  if (status === "saved") return "text-success";
  if (status === "error") return "text-danger";
  return "text-muted";
}

function statusText(saveState = {}) {
  const status = saveState?.status || "idle";

  if (status === "saving") {
    return t("weeklyReview.status.saving");
  }
  if (status === "saved") {
    const savedAt = saveState?.savedAt instanceof Date ? saveState.savedAt : null;
    if (savedAt && !Number.isNaN(savedAt.getTime())) {
      return formatTemplate(t("weeklyReview.status.savedAt"), {
        time: savedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      });
    }
    return t("weeklyReview.status.saved");
  }
  if (status === "error") {
    return t("weeklyReview.status.error");
  }
  return t("weeklyReview.status.idle");
}

export function renderWeeklyReviewSaveState(saveState = {}) {
  const el = byId("wrSaveStatus");
  if (!el) return;

  el.classList.remove("text-primary", "text-success", "text-danger", "text-muted");
  el.classList.add(statusClass(saveState?.status || "idle"));
  el.textContent = statusText(saveState);
}

export function readWeeklyReviewPlanForm() {
  return {
    focusTheme: byId("wrFocusTheme")?.value || "",
    topPriorities: [byId("wrTopPriority1")?.value || "", byId("wrTopPriority2")?.value || "", byId("wrTopPriority3")?.value || ""],
    riskNote: byId("wrRiskNote")?.value || "",
    actionCommitments: byId("wrActionCommitments")?.value || "",
  };
}

export function renderWeeklyReviewPage(vm, saveState = {}) {
  setText("wrHeaderTitle", t("weeklyReview.header.title"));
  setText(
    "wrHeaderSubtitle",
    t("weeklyReview.header.subtitle")
  );
  setText("wrFinanceTitle", t("weeklyReview.cards.finance"));
  setText("wrGoalsTitle", t("weeklyReview.cards.goals"));
  setText("wrVideoTitle", t("weeklyReview.cards.video"));
  setText("wrVideoPerformanceTitle", t("weeklyReview.cards.videoPerformance"));
  setText("wrMotivationTitle", t("weeklyReview.cards.motivation"));
  setText("wrHistoryTitle", t("weeklyReview.history.title"));
  setText("wrPlanTitle", t("weeklyReview.plan.title"));
  setText("wrLabelFocusTheme", t("weeklyReview.plan.focusTheme"));
  setText("wrLabelTopPriority1", t("weeklyReview.plan.priority1"));
  setText("wrLabelTopPriority2", t("weeklyReview.plan.priority2"));
  setText("wrLabelTopPriority3", t("weeklyReview.plan.priority3"));
  setText("wrLabelRiskNote", t("weeklyReview.plan.riskNote"));
  setText("wrLabelActionCommitments", t("weeklyReview.plan.actionCommitments"));

  const saveBtn = byId("btnWeeklyReviewSave");
  if (saveBtn) saveBtn.textContent = t("weeklyReview.plan.save");

  setText("wrWeekLabel", vm?.weekLabel || t("weeklyReview.header.fallbackWeek"));

  setHtml("wrFinanceSnapshot", renderFinanceSnapshot(vm?.snapshot?.finance || {}));
  setHtml("wrGoalsSnapshot", renderGoalsSnapshot(vm?.snapshot?.goals || {}));
  setHtml("wrVideoSnapshot", renderVideoSnapshot(vm?.snapshot?.video || {}));
  setHtml("wrVideoPerformanceSnapshot", renderVideoPerformanceSnapshot(vm?.snapshot?.videoPerformance || {}));
  setHtml("wrMotivationSnapshot", renderMotivationSnapshot(vm?.snapshot?.motivation || {}));
  const insightList = Array.isArray(vm?.localInsight) ? vm.localInsight : [];
  setHtml(
    "wrVideoInsight",
    insightList.length
      ? `
      <div class="fw-semibold mb-1">${escapeHtml(t("weeklyReview.videoPerformance.insightTitle"))}</div>
      <ul class="mb-0 ps-3">${insightList
        .map((line) => `<li>${escapeHtml(String(line || ""))}</li>`)
        .join("")}</ul>
    `
      : `<span class="text-muted">${escapeHtml(t("weeklyReview.videoPerformance.healthy"))}</span>`
  );
  const plan = vm?.plan || {};
  if (byId("wrFocusTheme")) byId("wrFocusTheme").value = plan.focusTheme || "";
  if (byId("wrTopPriority1")) byId("wrTopPriority1").value = plan?.topPriorities?.[0] || "";
  if (byId("wrTopPriority2")) byId("wrTopPriority2").value = plan?.topPriorities?.[1] || "";
  if (byId("wrTopPriority3")) byId("wrTopPriority3").value = plan?.topPriorities?.[2] || "";
  if (byId("wrRiskNote")) byId("wrRiskNote").value = plan.riskNote || "";
  if (byId("wrActionCommitments")) byId("wrActionCommitments").value = plan.actionCommitments || "";

  setHtml("wrHistoryList", renderHistoryList(vm?.history || [], vm?.weekKey || ""));
  renderWeeklyReviewSaveState(saveState);
}

export function bindWeeklyReviewEvents({ onSave, onOpenHistory } = {}) {
  if (_eventsBound) return;

  const root = byId("weekly-review");
  if (!root) return;
  _eventsBound = true;

  byId("btnWeeklyReviewSave")?.addEventListener("click", () => {
    if (typeof onSave !== "function") return;
    onSave(readWeeklyReviewPlanForm());
  });

  byId("wrHistoryList")?.addEventListener("click", (e) => {
    if (typeof onOpenHistory !== "function") return;
    const button = e.target.closest("[data-week-key]");
    if (!button) return;
    const weekKey = String(button.dataset.weekKey || "").trim();
    if (!weekKey) return;
    onOpenHistory(weekKey);
  });
}

