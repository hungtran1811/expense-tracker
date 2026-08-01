import { t } from "../../shared/constants/copy.vi.js";
import { formatCurrency } from "../finance/finance.controller.js";

const MONTH_BAR_KEYS = new Set(["balance", "income", "expense", "net", "debt"]);
const CHART_COLORS = ["#4f46e5", "#0d9488", "#7c8cff", "#d97706", "#e11d48"];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleAttr(value = "") {
  const text = String(value || "").trim();
  return text ? ` title="${escapeHtml(text)}"` : "";
}

function renderTop(vm = {}) {
  const titleEl = byId("homeTitle");
  const monthEl = byId("homeMonthLabel");
  if (titleEl) titleEl.textContent = t("home.pageTitle", "Tổng quan");
  if (monthEl) monthEl.textContent = String(vm?.monthLabel || "").trim();
}

function renderAccountsHeadings() {
  const titleEl = byId("homeAccountsTitle");
  if (titleEl) titleEl.textContent = t("home.accountsTitle", "Ví");
}

function renderAccountsGrid(container, accounts = []) {
  if (!container) return;
  const list = Array.isArray(accounts) ? accounts : [];

  if (!list.length) {
    container.innerHTML = `
      <div class="home-empty-inline" style="grid-column: 1 / -1;">
        <strong>${escapeHtml(t("home.noAccounts", "Chưa có tài khoản"))}</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map(
      (card) => `
        <article class="home-account-card${card.isFiltered ? " is-filtered" : ""}">
          <strong class="home-account-balance u-money"${titleAttr(card.balanceTitle)}>${escapeHtml(card.balanceText || "0đ")}</strong>
          <div class="home-account-name-row">
            <span class="home-account-name u-ellipsis">${escapeHtml(card.name || "Không rõ")}</span>
            ${card.isDefault ? '<span class="ledger-chip transfer">Mặc định</span>' : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderAccountFilter(block = {}) {
  const railEl = byId("homeAccountFilter");
  const options = Array.isArray(block?.options) ? block.options : [];
  const selectedId = String(block?.accountId || "all").trim() || "all";

  if (!railEl) return;

  if (!options.length) {
    railEl.innerHTML = "";
    return;
  }

  const chips = [
    { id: "all", label: t("home.filterAll", "Tất cả") },
    ...options.map((item) => ({
      id: String(item?.id || "").trim(),
      label: String(item?.name || "").trim(),
    })),
  ];

  railEl.innerHTML = chips
    .map((chip) => {
      const isActive = chip.id === selectedId;
      return `
        <button
          type="button"
          class="home-account-filter-chip${isActive ? " is-active" : ""}"
          data-home-account-filter="${escapeHtml(chip.id)}"
          role="tab"
          aria-selected="${isActive ? "true" : "false"}"
        >
          <span class="home-account-filter-chip-label u-ellipsis">${escapeHtml(chip.label)}</span>
        </button>
      `;
    })
    .join("");
}

function renderTodaySection(block = {}) {
  const summaryEl = byId("homeTodaySummary");
  const listEl = byId("homeTodayList");
  const items = Array.isArray(block?.items) ? block.items : [];
  const moreCount = Number(block?.moreCount || 0);

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="home-today-metric tone-income">
        <span class="home-today-metric-label">${escapeHtml(t("home.todayIncome", "Thu"))}</span>
        <strong class="home-today-metric-value u-money">${escapeHtml(block?.incomeTotalText || "0đ")}</strong>
      </div>
      <div class="home-today-metric tone-expense">
        <span class="home-today-metric-label">${escapeHtml(t("home.todayExpense", "Chi"))}</span>
        <strong class="home-today-metric-value u-money">${escapeHtml(block?.expenseTotalText || "0đ")}</strong>
      </div>
    `;
  }

  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(block?.emptyTitle || t("home.todayEmpty", "Chưa có thu chi"))}</strong>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    ${items
      .map((row) => {
        const meta = [row.categoryLabel, row.accountLabel].filter(Boolean).join(" · ");
        return `
          <article class="home-today-row" data-home-today-id="${escapeHtml(row.id)}">
            <div class="home-today-main">
              <div class="home-today-title u-ellipsis">${escapeHtml(row.title)}</div>
              <div class="home-today-meta u-ellipsis">${escapeHtml(meta)}</div>
            </div>
            <strong class="home-today-amount u-money ${escapeHtml(row.amountClass)}">${escapeHtml(row.amountText)}</strong>
          </article>
        `;
      })
      .join("")}
    ${
      moreCount > 0
        ? `<a class="home-today-more" data-route-link href="#expenses">+${moreCount} giao dịch</a>`
        : ""
    }
  `;
}

function renderMonthBar(container, items = []) {
  if (!container) return;
  const list = (Array.isArray(items) ? items : []).filter((item) => MONTH_BAR_KEYS.has(String(item?.key || "")));

  container.innerHTML = list
    .map((item) => {
      const tone = escapeHtml(item.tone || "net");
      const body = `
        <span class="home-month-label u-ellipsis">${escapeHtml(item.label)}</span>
        <strong class="home-month-value u-money"${titleAttr(item.valueTitle)}>${escapeHtml(item.valueText)}</strong>
      `;
      const link = String(item?.link || "").trim();
      if (link) {
        return `
          <a class="home-month-metric home-month-metric-link tone-${tone}" data-route-link href="${escapeHtml(link)}">
            ${body}
          </a>
        `;
      }
      return `<article class="home-month-metric tone-${tone}">${body}</article>`;
    })
    .join("");
}

function buildDonutMarkup(items = [], centerValue = "") {
  const colored = items.slice(0, 5).map((item, index) => ({
    ...item,
    chartColor: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const circumference = 2 * Math.PI * 54;
  let offset = 0;

  const segments = colored
    .map((item) => {
      const share = Math.max(0, Number(item?.share || 0));
      const length = (share / 100) * circumference;
      const segment = `
        <circle
          cx="70" cy="70" r="54" fill="none"
          stroke="${escapeHtml(item.chartColor)}"
          stroke-width="16"
          stroke-linecap="butt"
          stroke-dasharray="${length} ${circumference - length}"
          stroke-dashoffset="${-offset}"
          transform="rotate(-90 70 70)"
        ></circle>
      `;
      offset += length;
      return segment;
    })
    .join("");

  return `
    <div class="home-donut-shell">
      <svg class="home-donut-chart" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(79, 70, 229, 0.12)" stroke-width="16"></circle>
        ${segments}
      </svg>
      <div class="home-donut-center">
        <strong>${escapeHtml(centerValue || "—")}</strong>
      </div>
    </div>
  `;
}

function renderCategoryChart(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];

  if (!items.length) {
    container.innerHTML = `
      <div class="home-empty-inline home-empty-chart">
        <strong>${escapeHtml(block?.emptyTitle || t("home.noCategory", "Chưa có chi"))}</strong>
      </div>
    `;
    return;
  }

  const colored = items.map((item, index) => ({
    ...item,
    chartColor: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const center = colored[0]?.shareText || "—";

  container.innerHTML = `
    <div class="home-category-chart">
      ${buildDonutMarkup(colored, center)}
      <div class="home-category-legend">
        ${colored
          .map(
            (item) => `
              <div class="home-category-legend-row">
                <span class="home-category-swatch" style="background:${escapeHtml(item.chartColor)}"></span>
                <span class="home-category-legend-label u-ellipsis">${escapeHtml(item.label)}</span>
                <strong class="home-category-legend-value u-money">${escapeHtml(item.totalText || "0đ")}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderSpendChart(container, dailyFlow = {}, metaEl = null) {
  if (!container) return;
  const items = Array.isArray(dailyFlow?.items) ? dailyFlow.items : [];
  const recent = items.slice(-14);
  const maxExpense = recent.reduce((acc, item) => Math.max(acc, Number(item?.expense || 0)), 0);

  if (metaEl) {
    metaEl.textContent = maxExpense > 0 ? formatCurrency(maxExpense) : "";
  }

  if (!recent.length || !(maxExpense > 0)) {
    container.innerHTML = `
      <div class="home-empty-inline home-empty-chart">
        <strong>${escapeHtml(dailyFlow?.emptyTitle || t("home.dailyFlowEmpty", "Chưa có chi"))}</strong>
      </div>
    `;
    return;
  }

  const safeMax = maxExpense || 1;
  container.innerHTML = `
    <div class="home-spend-chart" role="img" aria-label="Chi theo ngày">
      ${recent
        .map((item) => {
          const expense = Number(item?.expense || 0);
          const height = Math.max(expense > 0 ? 8 : 0, Math.round((expense / safeMax) * 100));
          const day = String(item?.dateKey || "").slice(-2);
          return `
            <div class="home-spend-col" title="${escapeHtml(item.dateLabel || day)}: ${escapeHtml(item.expenseText || "0đ")}">
              <span class="home-spend-bar" style="height:${height}%"></span>
              <em class="home-spend-day">${escapeHtml(day)}</em>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRecentSection(block = {}) {
  const titleEl = byId("homeRecentTitle");
  if (titleEl) titleEl.textContent = t("home.recentTitle", "Giao dịch gần đây");

  const listEl = byId("homeRecentList");
  if (!listEl) return;

  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    listEl.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(block?.emptyTitle || t("home.noRecent", "Chưa có giao dịch gần đây"))}</strong>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="home-recent-list">
      ${items
        .map((row) => {
          const meta = [row.dateLabel, row.categoryLabel, row.accountLabel].filter(Boolean).join(" · ");
          return `
            <article class="home-today-row" data-home-recent-id="${escapeHtml(row.id)}">
              <div class="home-today-main">
                <div class="home-today-title u-ellipsis">${escapeHtml(row.title)}</div>
                <div class="home-today-meta u-ellipsis">${escapeHtml(meta)}</div>
              </div>
              <strong class="home-today-amount u-money ${escapeHtml(row.amountClass)}">${escapeHtml(row.amountText)}</strong>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderHomeRoute(vm = {}) {
  renderTop(vm);
  renderMonthBar(byId("homeMonthBar"), vm?.monthBar || []);
  renderAccountFilter(vm?.accountFilter || {});
  renderCategoryChart(byId("homeCategoryChart"), vm?.categoryBreakdown || {});
  renderSpendChart(byId("homeSpendChart"), vm?.dailyFlow || {}, byId("homeSpendChartMeta"));

  const categoryTitle = byId("homeCategoryChartTitle");
  if (categoryTitle) categoryTitle.textContent = t("home.categoryChartTitle", "Chi theo danh mục");
  const spendTitle = byId("homeSpendChartTitle");
  if (spendTitle) spendTitle.textContent = t("home.spendChartTitle", "Chi theo ngày");

  renderAccountsHeadings();
  renderAccountsGrid(byId("homeAccountsGrid"), vm?.accountHighlights || []);
  renderTodaySection(vm?.todayLedger || {});
  renderRecentSection(vm?.recentTransactions || {});
}
