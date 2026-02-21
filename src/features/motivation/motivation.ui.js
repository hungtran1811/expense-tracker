import { t } from "../../shared/constants/copy.vi.js";

function percent(done, target) {
  const safeTarget = Math.max(1, Number(target || 0));
  const safeDone = Math.max(0, Number(done || 0));
  return Math.min(100, Math.round((safeDone / safeTarget) * 100));
}

export function renderMotivationDashboard(container, summary) {
  if (!container) return;

  container.innerHTML = `
    <div class="motivation-grid">
      <div class="motivation-card">
        <div class="label">Tiến độ hôm nay</div>
        <div class="value">${summary.day.percent}%</div>
      </div>
      <div class="motivation-card">
        <div class="label">Tiến độ tuần</div>
        <div class="value">${summary.week.percent}%</div>
      </div>
      <div class="motivation-card">
        <div class="label">Tiến độ tháng</div>
        <div class="value">${summary.month.percent}%</div>
      </div>
    </div>
    <div class="small text-muted mt-2">
      Hôm nay ${summary.day.done}/${summary.day.target} • Tuần ${summary.week.done}/${summary.week.target} • Tháng ${
        summary.month.done
      }/${summary.month.target}
    </div>
  `;
}

export function renderMotivationDetails(summary) {
  const dayEl = document.getElementById("challengeDayValue");
  const weekEl = document.getElementById("challengeWeekValue");
  const monthEl = document.getElementById("challengeMonthValue");

  if (dayEl) dayEl.textContent = `${summary.day.done}/${summary.day.target} (${summary.day.percent}%)`;
  if (weekEl) weekEl.textContent = `${summary.week.done}/${summary.week.target} (${summary.week.percent}%)`;
  if (monthEl) monthEl.textContent = `${summary.month.done}/${summary.month.target} (${summary.month.percent}%)`;

  const challengeLabel = document.getElementById("goalsChallengeLabel");
  if (challengeLabel) {
    challengeLabel.textContent = `${t(
      "goals.dailyFocus.subtitle",
      "Ưu tiên các thói quen còn thiếu quota để giữ tiến độ tuần."
    )} • ${summary.day.percent}% hôm nay`;
  }
}

export function buildDefaultMotivationSummary() {
  return {
    day: { done: 0, target: 0, percent: 0 },
    week: { done: 0, target: 0, percent: 0 },
    month: { done: 0, target: 0, percent: 0 },
  };
}

export function calcProgress(done, target) {
  return {
    done,
    target,
    percent: percent(done, target),
  };
}