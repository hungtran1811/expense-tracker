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
        <div class="label">Chuỗi ngày hiện tại</div>
        <div class="value">${summary.streak}</div>
      </div>
      <div class="motivation-card">
        <div class="label">Tổng XP</div>
        <div class="value">${summary.totalXp}</div>
      </div>
      <div class="motivation-card">
        <div class="label">Cấp độ</div>
        <div class="value">${summary.level}</div>
      </div>
    </div>
    <div class="small text-muted mt-2">
      Thử thách ngày ${summary.day.percent}% • tuần ${summary.week.percent}% • tháng ${summary.month.percent}%
    </div>
  `;
}

export function renderMotivationDetails(summary) {
  const dayEl = document.getElementById("challengeDayValue");
  const weekEl = document.getElementById("challengeWeekValue");
  const monthEl = document.getElementById("challengeMonthValue");
  const streakEl = document.getElementById("streakValue");
  const xpEl = document.getElementById("totalXpValue");
  const levelEl = document.getElementById("levelValue");

  if (dayEl) dayEl.textContent = `${summary.day.done}/${summary.day.target} (${summary.day.percent}%)`;
  if (weekEl) weekEl.textContent = `${summary.week.done}/${summary.week.target} (${summary.week.percent}%)`;
  if (monthEl) monthEl.textContent = `${summary.month.done}/${summary.month.target} (${summary.month.percent}%)`;
  if (streakEl) streakEl.textContent = String(summary.streak);
  if (xpEl) xpEl.textContent = String(summary.totalXp);
  if (levelEl) levelEl.textContent = String(summary.level);

  const challengeLabel = document.getElementById("goalsChallengeLabel");
  if (challengeLabel) {
    challengeLabel.textContent = `${t("dashboard.modules.motivation.subtitle", "")} • ${summary.day.percent}% hôm nay`;
  }
}

export function buildDefaultMotivationSummary() {
  return {
    streak: 0,
    totalXp: 0,
    level: 1,
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
