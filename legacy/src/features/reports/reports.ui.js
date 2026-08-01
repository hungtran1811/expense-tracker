import { t } from "../../shared/constants/copy.vi.js";
import { buildDefaultReportFilters } from "./reports.controller.js";

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

function renderEmptyBlock(container, title = "") {
  if (!container) return;
  container.innerHTML = `
    <div class="finance-empty finance-empty-compact">
      <strong>${escapeHtml(title || "Chưa có dữ liệu")}</strong>
    </div>
  `;
}

function clampPercent(value = 0, fallback = 8) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return `${fallback}%`;
  return `${Math.max(fallback, Math.min(numeric, 100))}%`;
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
    { label: "Số dư", value: summary.totalBalanceText || "0đ", tone: "net" },
    { label: "Thu", value: summary.incomeTotalText || "0đ", tone: "income" },
    { label: "Chi", value: summary.expenseTotalText || "0đ", tone: "expense" },
    { label: "Còn lại", value: summary.netTotalText || "0đ", tone: "net" },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
        <article class="finance-metric-card report-metric-card ${escapeHtml(card.tone)}">
          <span class="finance-metric-label">${escapeHtml(card.label)}</span>
          <strong class="finance-metric-value u-money" title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
        </article>
      `
    )
    .join("");
}

function syncReportsChrome(options = {}) {
  const titleEl = byId("reportsPageTitle");
  if (titleEl) titleEl.textContent = t("routeMeta.reports.title", "Báo cáo");

  const infoEl = byId("reportsWorkspaceInfo");
  if (infoEl) infoEl.textContent = "";

  const sectionMap = [
    ["reportCashSnapshotTitle", "reports.sectionCash", "Số dư ví"],
    ["reportQuickSignalsTitle", "reports.sectionSignals", "Điểm nổi bật"],
    ["reportAttentionTitle", "reports.sectionAttention", "Khoản lớn nhất"],
    ["reportCategoryBreakdownTitle", "reports.sectionCategory", "Danh mục chi"],
    ["reportScopeBreakdownTitle", "reports.sectionScope", "Nhóm chi"],
    ["reportAccountBreakdownTitle", "reports.sectionAccounts", "Biến động tài khoản"],
  ];

  sectionMap.forEach(([id, key, fallback]) => {
    const el = byId(id);
    if (el) el.textContent = t(key, fallback);
  });

  const dailyTitle = byId("reportDailyFlowTitle");
  if (dailyTitle) dailyTitle.textContent = t("reports.sectionDailySpend", "Chi theo ngày");

  const applyBtn = byId("btnApplyReportFilters");
  if (applyBtn) applyBtn.textContent = t("reports.apply", "Áp dụng");

  const resetBtn = byId("btnResetReportFilters");
  if (resetBtn) resetBtn.textContent = t("reports.reset", "Đặt lại");

  const exportBtn = byId("btnExportReportCsv");
  if (exportBtn) {
    exportBtn.textContent = t("reports.exportCsv", "CSV");
    exportBtn.disabled = options?.reportsDataLoaded === false;
  }

  const aiBtn = byId("btnAiReportInsights");
  if (aiBtn) {
    aiBtn.textContent = t("reports.aiSummary", "Tóm tắt AI");
    aiBtn.classList.add("d-none");
    aiBtn.disabled = true;
  }

  const aiTitleEl = byId("reportsAiInsightsTitle");
  if (aiTitleEl) aiTitleEl.textContent = t("reports.aiSummaryTitle", "Tóm tắt AI");

  const aiMetaEl = byId("reportsAiInsightsMeta");
  if (aiMetaEl) aiMetaEl.textContent = "";
}

function renderReportsAiInsights() {
  const panel = byId("reportsAiInsightsPanel");
  const body = byId("reportsAiInsightsBody");
  if (!panel || !body) return;

  panel.classList.add("d-none");
  body.innerHTML = "";
}

function renderCashSnapshot(container, snapshot = {}) {
  if (!container) return;
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  if (!items.length) {
    renderEmptyBlock(container, "Chưa có ví");
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="overview-balance-card report-cash-card report-cash-card-compact">
          <div class="overview-balance-top">
            <strong class="u-ellipsis">${escapeHtml(item.name)}</strong>
          </div>
          <div class="overview-balance-value u-money">${escapeHtml(item.balanceText)}</div>
        </article>
      `
    )
    .join("");
}

function renderQuickSignals(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmptyBlock(container, block?.emptyTitle || "Chưa có điểm nổi bật");
    return;
  }

  container.innerHTML = `
    <div class="report-signal-grid report-signal-grid-compact">
      ${items
        .map(
          (item) => `
            <article class="report-signal-card ${escapeHtml(item.tone || "neutral")}">
              <div class="report-signal-label">${escapeHtml(item.label)}</div>
              <strong class="report-signal-value u-money">${escapeHtml(item.valueText)}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAttentionItems(container, block = {}) {
  if (!container) return;
  const largestExpense = block?.largestExpense || null;
  if (!largestExpense) {
    renderEmptyBlock(container, block?.emptyTitle || "Chưa có khoản lớn");
    return;
  }

  container.innerHTML = `
    <article class="reports-attention-highlight reports-attention-highlight-compact">
      <div class="report-highlight-head">
        <strong class="report-highlight-title u-ellipsis">${escapeHtml(largestExpense.title)}</strong>
        <strong class="overview-list-value negative u-money">${escapeHtml(largestExpense.amountText)}</strong>
      </div>
      <div class="report-highlight-meta u-ellipsis">
        ${escapeHtml(
          [largestExpense.dateLabel, largestExpense.accountLabel, largestExpense.scopeLabel]
            .filter(Boolean)
            .join(" · ")
        )}
      </div>
    </article>
  `;
}

function renderBreakdownChart(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "Chưa có dữ liệu");
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
            <article
              class="report-chart-item${breakdown?.drillKind && item.key !== "unknown" ? " report-chart-item-drill" : ""}"
              ${breakdown?.drillKind && item.key !== "unknown" ? `data-report-drill="${escapeHtml(breakdown.drillKind)}" data-drill-key="${escapeHtml(item.key)}" role="button" tabindex="0"` : ""}
            >
              <div class="report-chart-head">
                <div class="report-chart-title-wrap">
                  <span class="report-chart-rank" style="background:${escapeHtml(item.chartColor)}1a;color:${escapeHtml(
                    item.chartColor
                  )};">${index + 1}</span>
                  <div>
                    <div class="report-chart-title">${escapeHtml(item.label)}</div>
                    <div class="report-chart-meta">${escapeHtml(item.shareText)}</div>
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

function renderAccountBreakdown(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "Chưa có biến động");
    return;
  }

  const maxFlow =
    items.reduce(
      (max, item) =>
        Math.max(max, Number(item?.inflow || 0), Number(item?.outflow || 0), Math.abs(Number(item?.net || 0))),
      0
    ) || 1;

  container.innerHTML = `
    <div class="report-account-grid report-account-grid-compact">
      ${items
        .map((item) => {
          const inflowWidth = clampPercent((Number(item?.inflow || 0) / maxFlow) * 100, 6);
          const outflowWidth = clampPercent((Number(item?.outflow || 0) / maxFlow) * 100, 6);
          return `
            <article class="report-account-card-v2 report-account-card-compact report-account-card-drill" data-report-drill="account" data-drill-key="${escapeHtml(item.accountId)}" role="button" tabindex="0">
              <div class="report-account-head-v2">
                <div class="report-account-name u-ellipsis">${escapeHtml(item.name)}</div>
                <div class="report-account-balance-v2 u-money">${escapeHtml(item.currentBalanceText)}</div>
              </div>
              <div class="report-account-bars">
                <div class="report-account-bar-row">
                  <span>Vào</span>
                  <div class="report-account-bar-track"><span class="inflow" style="width:${inflowWidth}"></span></div>
                  <strong class="u-money">${escapeHtml(item.inflowText)}</strong>
                </div>
                <div class="report-account-bar-row">
                  <span>Ra</span>
                  <div class="report-account-bar-track"><span class="outflow" style="width:${outflowWidth}"></span></div>
                  <strong class="u-money">${escapeHtml(item.outflowText)}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderDailyFlow(container, dailyFlow = {}) {
  if (!container) return;
  const items = Array.isArray(dailyFlow?.items) ? dailyFlow.items : [];
  const chartItems = items.length > 21 ? items.slice(-21) : items;
  const maxExpense = chartItems.reduce((acc, item) => Math.max(acc, Number(item?.expense || 0)), 0);
  const peakEl = byId("reportDailyFlowPeak");
  if (peakEl) {
    peakEl.textContent =
      maxExpense > 0
        ? `Đỉnh ${chartItems.find((item) => Number(item?.expense || 0) === maxExpense)?.expenseText || ""}`
        : "";
  }

  if (!(maxExpense > 0)) {
    renderEmptyBlock(container, dailyFlow?.emptyTitle || "Chưa có chi");
    return;
  }

  const safeMax = maxExpense || 1;
  const colCount = Math.min(Math.max(chartItems.length, 7), 21);
  container.innerHTML = `
    <div class="report-spend-chart" style="--report-spend-cols:${colCount}" role="img" aria-label="Chi theo ngày">
      ${chartItems
        .map((item) => {
          const expense = Number(item?.expense || 0);
          const height = Math.max(expense > 0 ? 8 : 0, Math.round((expense / safeMax) * 100));
          const day = String(item?.dateKey || "").slice(-2);
          return `
            <div class="report-spend-col" title="${escapeHtml(item.dateLabel || day)}: ${escapeHtml(item.expenseText || "0đ")}">
              <span class="report-spend-bar" style="height:${height}%"></span>
              <em class="report-spend-day">${escapeHtml(day)}</em>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function withReportEmptyCopy(block = {}, titleKey = "") {
  return {
    ...block,
    emptyTitle: block?.emptyTitle || t(titleKey, ""),
    emptyBody: block?.emptyBody || "",
  };
}

function renderReportsLoadPrompt(container, loaded = true) {
  if (!container) return;
  container.classList.toggle("d-none", loaded);
  if (loaded) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="workspace-empty workspace-load-prompt">
      <strong>${escapeHtml(t("reports.loadTitle", "Báo cáo chi tiết"))}</strong>
      <p>${escapeHtml(t("reports.loadBody", "Kỳ hiện tại sẽ tải khi mở tab. Bấm Tải báo cáo nếu cần thử lại hoặc đổi kỳ rồi Áp dụng."))}</p>
      <button type="button" class="btn btn-sm btn-primary" id="btnLoadReports">
        ${escapeHtml(t("reports.loadAction", "Tải báo cáo"))}
      </button>
    </div>
  `;
}

function renderReportsMomSection(block = {}, options = {}) {
  const container = byId("reportsMomSection");
  if (!container) return;

  if (options?.reportsDataLoaded === false) {
    container.innerHTML = "";
    container.classList.add("d-none");
    return;
  }

  container.classList.remove("d-none");

  if (block?.loadPending) {
    container.innerHTML = `
      <div class="reports-mom-prompt-compact">
        <button type="button" class="btn btn-sm btn-outline-primary" id="btnLoadReportsMom">
          ${escapeHtml(t("reports.momLoadAction", "So với kỳ trước"))}
        </button>
      </div>
    `;
    return;
  }

  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="reports-mom-grid reports-mom-grid-compact" aria-label="${escapeHtml(t("reports.momLoadTitle", "So với kỳ trước"))}">
      ${items
        .map(
          (item) => `
            <article class="reports-mom-chip tone-${escapeHtml(item.key || "net")}">
              <span class="reports-mom-label">${escapeHtml(item.label)}</span>
              <strong class="reports-mom-delta tone-${escapeHtml(item.deltaTone || "up")}">${escapeHtml(item.deltaText || "0%")}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderReportsRoute(vm = {}, options = {}) {
  const reportsDataLoaded = options?.reportsDataLoaded !== false;
  const shellEl = document.querySelector("#reports .reports-shell");
  if (shellEl) shellEl.dataset.reportsLoaded = reportsDataLoaded ? "true" : "false";

  renderReportsLoadPrompt(byId("reportsLoadPrompt"), reportsDataLoaded);
  syncReportsChrome(options);
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
    const range = String(vm?.meta?.rangeLabel || "").trim();
    const count = String(vm?.meta?.transactionCountLabel || "").trim();
    metaEl.textContent = [range, count].filter(Boolean).join(" · ");
  }

  const cashMetaEl = byId("reportCashSnapshotMeta");
  if (cashMetaEl) cashMetaEl.textContent = "";

  const signalsMetaEl = byId("reportQuickSignalsMeta");
  if (signalsMetaEl) signalsMetaEl.textContent = "";

  const attentionMetaEl = byId("reportAttentionMeta");
  if (attentionMetaEl) attentionMetaEl.textContent = "";

  const scopeMetaEl = byId("reportScopeBreakdownMeta");
  if (scopeMetaEl) scopeMetaEl.textContent = "";

  renderReportsAiInsights();

  if (!reportsDataLoaded) {
    renderSummary(byId("reportsSummary"), {});
    renderDailyFlow(byId("reportDailyFlow"), {});
    return;
  }

  renderSummary(byId("reportsSummary"), vm?.summary || {});
  renderCashSnapshot(byId("reportCashSnapshot"), vm?.cashSnapshot || {});
  renderQuickSignals(byId("reportQuickSignals"), withReportEmptyCopy(vm?.quickSignals, "reports.emptySignals"));
  renderAttentionItems(byId("reportAttentionItems"), withReportEmptyCopy(vm?.attentionItems, "reports.emptyAttention"));
  renderBreakdownChart(
    byId("reportCategoryBreakdown"),
    withReportEmptyCopy({ ...vm?.categoryBreakdown, drillKind: "category" }, "reports.emptyCategory")
  );
  renderBreakdownChart(
    byId("reportScopeBreakdown"),
    withReportEmptyCopy({ ...vm?.scopeBreakdown, drillKind: "scope" }, "reports.emptyScope")
  );
  renderAccountBreakdown(byId("reportAccountBreakdown"), withReportEmptyCopy(vm?.accountBreakdown, "reports.emptyAccount"));
  renderReportsMomSection(vm?.momComparison || {}, options);
  renderDailyFlow(byId("reportDailyFlow"), withReportEmptyCopy(vm?.dailyFlow, "reports.emptyDaily"));

  const emptyEl = byId("reportsEmptyState");
  if (emptyEl) {
    const isEmpty = !!vm?.emptyState?.isEmpty;
    emptyEl.classList.toggle("d-none", !isEmpty);
    emptyEl.innerHTML = isEmpty
      ? `
        <div class="finance-empty finance-empty-compact">
          <strong>${escapeHtml(vm?.emptyState?.title || "")}</strong>
        </div>
      `
      : "";
  }
}
