import { buildDefaultReportFilters } from "./reports.controller.js";

const CHART_COLORS = ["#245cff", "#59e1c1", "#7d8cff", "#f2c054", "#f07a9a"];

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

function fillSelect(selectEl, items = [], selectedValue = "", placeholder = "") {
  if (!selectEl) return;
  const options = [];
  if (placeholder) {
    options.push(`<option value="all">${escapeHtml(placeholder)}</option>`);
  }
  items.forEach((item) => {
    const value = String(item?.value ?? item?.key ?? "").trim();
    const label = String(item?.label ?? item?.name ?? "").trim();
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  });
  selectEl.innerHTML = options.join("");
  selectEl.value = String(
    selectedValue || (placeholder ? "all" : items[0]?.value || items[0]?.key || "")
  ).trim();
}

function renderEmptyBlock(container, title = "", body = "") {
  if (!container) return;
  container.innerHTML = `
    <div class="finance-empty">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(body)}</div>
    </div>
  `;
}

function clampPercent(value = 0, fallback = 8) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return `${fallback}%`;
  return `${Math.max(fallback, Math.min(numeric, 100))}%`;
}

function toneToChip(tone = "") {
  if (tone === "danger" || tone === "expense") return "expense";
  if (tone === "warning" || tone === "adjustment") return "adjustment";
  if (tone === "success" || tone === "income") return "income";
  return "transfer";
}

function toShortDateLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return raw;
  return `${match[1]}/${match[2]}`;
}

function colorizeItems(items = []) {
  return items.map((item, index) => ({
    ...item,
    chartColor: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function buildDonutMarkup(items = [], centerValue = "") {
  const coloredItems = colorizeItems(items.slice(0, 5));
  const circumference = 2 * Math.PI * 54;
  let offset = 0;

  const segments = coloredItems
    .map((item) => {
      const share = Math.max(0, Number(item?.share || 0));
      const length = (share / 100) * circumference;
      const segment = `
        <circle
          cx="70"
          cy="70"
          r="54"
          fill="none"
          stroke="${escapeHtml(item.chartColor)}"
          stroke-width="16"
          stroke-linecap="round"
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
    <div class="report-donut-shell">
      <svg class="report-donut-chart" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(223, 232, 244, 0.92)" stroke-width="16"></circle>
        ${segments}
      </svg>
      <div class="report-donut-center">
        <span class="report-donut-center-label">Top</span>
        <strong class="report-donut-center-value">${escapeHtml(centerValue || "--")}</strong>
      </div>
    </div>
  `;
}

function renderSummary(container, summary = {}) {
  if (!container) return;
  const cards = [
    {
      label: "Tổng tiền",
      value: summary.totalBalanceText || "0đ",
      note: "Số dư hiện tại",
      tone: "net",
    },
    {
      label: "Thu",
      value: summary.incomeTotalText || "0đ",
      note: `${summary.transactionCount || 0} giao dịch`,
      tone: "income",
    },
    {
      label: "Chi",
      value: summary.expenseTotalText || "0đ",
      note: "Phát sinh chi",
      tone: "expense",
    },
    {
      label: "Chênh lệch",
      value: summary.netTotalText || "0đ",
      note: summary.adjustmentMetaText || "Thu - Chi + Điều chỉnh",
      tone: "net",
    },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
        <article class="finance-metric-card report-metric-card ${escapeHtml(card.tone)}">
          <span class="finance-metric-label">${escapeHtml(card.label)}</span>
          <strong class="finance-metric-value">${escapeHtml(card.value)}</strong>
          <div class="finance-metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderCashSnapshot(container, snapshot = {}) {
  if (!container) return;
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  if (!items.length) {
    renderEmptyBlock(
      container,
      "Chưa có tài khoản nổi bật",
      "Thêm tài khoản hoặc bỏ lọc tài khoản để xem nhanh số dư hiện tại."
    );
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="overview-balance-card report-cash-card">
          <div class="overview-balance-top">
            <strong>${escapeHtml(item.name)}</strong>
            ${item.isDefault ? '<span class="ledger-chip transfer">Mặc định</span>' : ""}
          </div>
          <div class="overview-balance-value">${escapeHtml(item.balanceText)}</div>
          <div class="overview-balance-note">${escapeHtml(item.metaText)}</div>
        </article>
      `
    )
    .join("");
}

function renderQuickSignals(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmptyBlock(container, block?.emptyTitle || "", block?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-signal-grid">
      ${items
        .map((item, index) => {
          const width = clampPercent(100 - index * 12, 36);
          return `
            <article class="report-signal-card ${escapeHtml(item.tone || "neutral")}">
              <div class="report-signal-label">${escapeHtml(item.label)}</div>
              <strong class="report-signal-value">${escapeHtml(item.valueText)}</strong>
              <div class="report-signal-meter">
                <span style="width:${width}"></span>
              </div>
              <div class="report-signal-note">${escapeHtml(item.note)}</div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAttentionItems(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  const largestExpense = block?.largestExpense || null;
  if (!items.length && !largestExpense) {
    renderEmptyBlock(container, block?.emptyTitle || "", block?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-attention-layout">
      ${
        largestExpense
          ? `
            <article class="reports-attention-highlight">
              <div class="report-highlight-label">Khoản lớn nhất</div>
              <div class="report-highlight-head">
                <strong class="report-highlight-title">${escapeHtml(largestExpense.title)}</strong>
                <strong class="overview-list-value negative">${escapeHtml(largestExpense.amountText)}</strong>
              </div>
              <div class="report-highlight-meta">
                ${escapeHtml(largestExpense.dateLabel)} · ${escapeHtml(largestExpense.accountLabel)} · ${escapeHtml(largestExpense.scopeLabel)}
              </div>
              ${
                largestExpense.note
                  ? `<div class="report-highlight-note">${escapeHtml(largestExpense.note)}</div>`
                  : ""
              }
            </article>
          `
          : ""
      }
      ${
        items.length
          ? `
            <div class="report-note-list">
              ${items
                .map(
                  (item) => `
                    <article class="report-note-item">
                      <span class="report-note-dot"></span>
                      <span>${escapeHtml(item)}</span>
                    </article>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderBreakdownChart(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "", breakdown?.emptyBody || "");
    return;
  }

  const coloredItems = colorizeItems(items.slice(0, 5));
  const topShare = coloredItems[0]?.shareText || "--";
  container.innerHTML = `
    <div class="report-donut-layout">
      ${buildDonutMarkup(coloredItems, topShare)}
      <div class="report-chart-list">
        ${coloredItems
        .map(
          (item, index) => `
            <article class="report-chart-item">
              <div class="report-chart-head">
                <div class="report-chart-title-wrap">
                  <span class="report-chart-rank" style="background:${escapeHtml(item.chartColor)}1a;color:${escapeHtml(
                    item.chartColor
                  )};">${index + 1}</span>
                  <div>
                    <div class="report-chart-title">${escapeHtml(item.label)}</div>
                    <div class="report-chart-meta">${escapeHtml(item.count)} giao dịch • ${escapeHtml(item.shareText)}</div>
                  </div>
                </div>
                <strong class="report-chart-value">${escapeHtml(item.totalText)}</strong>
              </div>
              <div class="report-chart-bar">
                <span style="width:${escapeHtml(clampPercent(item.share, 10))};background:${escapeHtml(item.chartColor)};"></span>
              </div>
            </article>
          `
        )
        .join("")}
      </div>
    </div>
  `;
}

function renderBudgetComparison(container, comparison = {}) {
  if (!container) return;
  const items = Array.isArray(comparison?.items) ? comparison.items : [];
  const hasBudgets = Number(comparison?.configuredCount || 0) > 0;
  if (!items.length || !hasBudgets) {
    renderEmptyBlock(container, comparison?.emptyTitle || "", comparison?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-budget-grid">
      ${items
        .map(
          (item) => `
            <article class="report-budget-card ${escapeHtml(item.statusKey || "safe")}">
              <div class="report-budget-head">
                <div>
                  <div class="report-budget-title">${escapeHtml(item.scopeName)}</div>
                  <div class="report-budget-meta">${escapeHtml(item.percentText)} • ${escapeHtml(item.remainingText)}</div>
                </div>
                <span class="ledger-chip ${escapeHtml(item.statusTone || "transfer")}">${escapeHtml(item.statusLabel)}</span>
              </div>
              <div class="report-budget-bar">
                <span style="width:${escapeHtml(item.progressWidth || "0%")}"></span>
              </div>
              <div class="report-budget-values">
                <span>Đã chi <strong>${escapeHtml(item.spentText)}</strong></span>
                <span>Ngân sách <strong>${escapeHtml(item.limitText)}</strong></span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAccountBreakdown(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "", breakdown?.emptyBody || "");
    return;
  }

  const maxFlow = items.reduce(
    (max, item) => Math.max(max, Number(item?.inflow || 0), Number(item?.outflow || 0), Math.abs(Number(item?.net || 0))),
    0
  ) || 1;
  const maxBalance = items.reduce((max, item) => Math.max(max, Math.abs(Number(item?.currentBalance || 0))), 0) || 1;

  container.innerHTML = `
    <div class="report-account-grid">
      ${items
        .map((item) => {
          const inflowWidth = clampPercent((Number(item?.inflow || 0) / maxFlow) * 100, 6);
          const outflowWidth = clampPercent((Number(item?.outflow || 0) / maxFlow) * 100, 6);
          const netWidth = clampPercent((Math.abs(Number(item?.net || 0)) / maxFlow) * 100, 6);
          const balanceWidth = clampPercent((Math.abs(Number(item?.currentBalance || 0)) / maxBalance) * 100, 10);
          return `
            <article class="report-account-card-v2">
              <div class="report-account-head-v2">
                <div>
                  <div class="report-account-name">${escapeHtml(item.name)}</div>
                  <div class="report-account-type">${escapeHtml(item.typeLabel)}</div>
                </div>
                <div class="report-account-balance-v2">${escapeHtml(item.currentBalanceText)}</div>
              </div>
              <div class="report-account-balance-track">
                <span style="width:${balanceWidth}"></span>
              </div>
              <div class="report-account-bars">
                <div class="report-account-bar-row">
                  <span>Vào</span>
                  <div class="report-account-bar-track"><span class="inflow" style="width:${inflowWidth}"></span></div>
                  <strong>${escapeHtml(item.inflowText)}</strong>
                </div>
                <div class="report-account-bar-row">
                  <span>Ra</span>
                  <div class="report-account-bar-track"><span class="outflow" style="width:${outflowWidth}"></span></div>
                  <strong>${escapeHtml(item.outflowText)}</strong>
                </div>
                <div class="report-account-bar-row">
                  <span>Ròng</span>
                  <div class="report-account-bar-track"><span class="${Number(item?.net || 0) >= 0 ? "net-positive" : "net-negative"}" style="width:${netWidth}"></span></div>
                  <strong class="${Number(item?.net || 0) >= 0 ? "positive" : "negative"}">${escapeHtml(item.netText)}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDailyFlow(container, dailyFlow = {}) {
  if (!container) return;
  const items = Array.isArray(dailyFlow?.items) ? dailyFlow.items : [];
  const activeItems = items.filter((item) => item.income || item.expense || item.net || item.transfer);
  if (!activeItems.length) {
    renderEmptyBlock(container, dailyFlow?.emptyTitle || "", dailyFlow?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-flow-layout">
      <div class="report-flow-legend">
        <span><i class="income"></i> Thu</span>
        <span><i class="expense"></i> Chi</span>
        <span><i class="positive"></i> Ròng</span>
      </div>
      <div class="report-flow-columns">
        ${activeItems
        .map(
          (item) => `
            <article class="report-flow-column-card">
              <div class="report-flow-column-bars">
                <span class="report-flow-column income" style="height:${escapeHtml(item.incomeWidth || "0%")}"></span>
                <span class="report-flow-column expense" style="height:${escapeHtml(item.expenseWidth || "0%")}"></span>
                <span class="report-flow-column ${escapeHtml(item.netClass || "positive")}" style="height:${escapeHtml(item.netWidth || "0%")}"></span>
              </div>
              <div class="report-flow-column-label">${escapeHtml(toShortDateLabel(item.dateLabel))}</div>
              <div class="report-flow-column-net ${escapeHtml(item.netClass || "positive")}">${escapeHtml(item.netText)}</div>
              ${
                Number(item.transfer || 0) > 0
                  ? `<div class="report-flow-transfer">Chuyển khoản ${escapeHtml(item.transferText)}</div>`
                  : ""
              }
            </article>
          `
        )
        .join("")}
      </div>
    </div>
  `;
}

export function renderReportsRoute(vm = {}, options = {}) {
  const draftFilters = options?.draftFilters || vm?.filters || buildDefaultReportFilters();
  fillSelect(
    byId("reportAccountFilter"),
    vm?.filterOptions?.accountOptions || [],
    draftFilters.accountId || "all",
    "Tất cả tài khoản"
  );

  const fromDateEl = byId("reportFromDate");
  const toDateEl = byId("reportToDate");
  if (fromDateEl) fromDateEl.value = String(draftFilters.fromDate || "");
  if (toDateEl) toDateEl.value = String(draftFilters.toDate || "");

  const errorEl = byId("reportFilterError");
  if (errorEl) {
    const message = String(options?.error || "").trim();
    errorEl.textContent = message;
    errorEl.classList.toggle("d-none", !message);
  }

  const metaEl = byId("reportsSummaryMeta");
  if (metaEl) {
    metaEl.textContent = `${vm?.meta?.rangeLabel || ""} · ${vm?.meta?.transactionCountLabel || "0 giao dịch"} · ${
      vm?.meta?.accountFilterLabel || "Tất cả tài khoản"
    } · ${vm?.summary?.transferMetaText || "Chuyển khoản 0đ"} · ${vm?.meta?.exclusionNote || ""}`;
  }

  renderSummary(byId("reportsSummary"), vm?.summary || {});
  renderCashSnapshot(byId("reportCashSnapshot"), vm?.cashSnapshot || {});
  renderQuickSignals(byId("reportQuickSignals"), vm?.quickSignals || {});
  renderAttentionItems(byId("reportAttentionItems"), vm?.attentionItems || {});
  renderBreakdownChart(byId("reportCategoryBreakdown"), vm?.categoryBreakdown || {});
  renderBreakdownChart(byId("reportScopeBreakdown"), vm?.scopeBreakdown || {});
  renderBudgetComparison(byId("reportBudgetComparison"), vm?.budgetComparison || {});
  renderAccountBreakdown(byId("reportAccountBreakdown"), vm?.accountBreakdown || {});
  renderDailyFlow(byId("reportDailyFlow"), vm?.dailyFlow || {});

  const emptyEl = byId("reportsEmptyState");
  if (emptyEl) {
    const isEmpty = !!vm?.emptyState?.isEmpty;
    emptyEl.classList.toggle("d-none", !isEmpty);
    emptyEl.innerHTML = isEmpty
      ? `
        <div class="finance-empty">
          <strong>${escapeHtml(vm?.emptyState?.title || "")}</strong>
          <div>${escapeHtml(vm?.emptyState?.body || "")}</div>
        </div>
      `
      : "";
  }
}
