import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
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

function toDailyBarWidth(widthValue = "0%", minWhenPositive = 6) {
  const numeric = Number(String(widthValue || "0").replace("%", ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return "0%";
  return clampPercent(numeric, minWhenPositive);
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
          <strong class="finance-metric-value u-money" title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
          <div class="finance-metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function syncReportsChrome(options = {}) {
  const activePreset = String(options?.activePreset || "").trim();

  const titleEl = byId("reportsPageTitle");
  if (titleEl) titleEl.textContent = t("routeMeta.reports.title", "Báo cáo");

  const infoEl = byId("reportsWorkspaceInfo");
  if (infoEl) infoEl.textContent = t("reports.workspaceInfo", "Phân tích chi tiêu theo kỳ bạn chọn.");

  const sectionMap = [
    ["reportCashSnapshotTitle", "reports.sectionCash"],
    ["reportQuickSignalsTitle", "reports.sectionSignals"],
    ["reportAttentionTitle", "reports.sectionAttention"],
    ["reportCategoryBreakdownTitle", "reports.sectionCategory"],
    ["reportScopeBreakdownTitle", "reports.sectionScope"],
    ["reportAccountBreakdownTitle", "reports.sectionAccounts"],
  ];

  sectionMap.forEach(([id, key]) => {
    const el = byId(id);
    if (el) el.textContent = t(key, el.textContent);
  });

  const categoryMetaEl = byId("reportCategoryBreakdownMeta");
  if (categoryMetaEl) categoryMetaEl.textContent = t("reports.categorySubtitle", categoryMetaEl.textContent);

  const accountsMetaEl = byId("reportAccountBreakdownMeta");
  if (accountsMetaEl) accountsMetaEl.textContent = t("reports.accountsSubtitle", accountsMetaEl.textContent);

  const applyBtn = byId("btnApplyReportFilters");
  if (applyBtn) applyBtn.textContent = t("reports.apply", "Áp dụng");

  const resetBtn = byId("btnResetReportFilters");
  if (resetBtn) resetBtn.textContent = t("reports.reset", "Đặt lại");

  document.querySelectorAll("[data-report-preset]").forEach((button) => {
    const preset = String(button.getAttribute("data-report-preset") || "").trim();
    const labelKey =
      preset === "previous-month" ? "reports.presetPreviousMonth" : "reports.presetCurrentMonth";
    button.textContent = t(labelKey, button.textContent);
    button.classList.toggle("is-active", !!activePreset && preset === activePreset);
  });
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
            <article class="report-account-card-v2 report-account-card-drill" data-report-drill="account" data-drill-key="${escapeHtml(item.accountId)}" role="button" tabindex="0">
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

export function renderDailyFlow(container, dailyFlow = {}) {
  if (!container) return;
  const items = Array.isArray(dailyFlow?.items) ? dailyFlow.items : [];
  const activeItems = items
    .filter((item) => item.income || item.expense || item.net || item.transfer)
    .slice()
    .reverse();

  if (!activeItems.length) {
    renderEmptyBlock(container, dailyFlow?.emptyTitle || "", dailyFlow?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-daily-layout">
      <div class="report-daily-legend" aria-hidden="true">
        <span><i class="income"></i> Thu</span>
        <span><i class="expense"></i> Chi</span>
        <span><i class="net"></i> Ròng</span>
      </div>
      <div class="report-daily-list">
        ${activeItems
          .map((item) => {
            const netClass = escapeHtml(item.netClass || "positive");
            const incomeWidth = toDailyBarWidth(item.incomeWidth);
            const expenseWidth = toDailyBarWidth(item.expenseWidth);
            return `
              <article class="report-daily-row">
                <div class="report-daily-head">
                  <div class="report-daily-head-copy">
                    <div class="report-daily-date">${escapeHtml(item.dateLabel)}</div>
                    ${
                      Number(item.transfer || 0) > 0
                        ? `<div class="report-daily-meta">Chuyển khoản <span class="u-money">${escapeHtml(item.transferText)}</span></div>`
                        : ""
                    }
                  </div>
                  <strong class="report-daily-net ${netClass} u-money" title="${escapeHtml(item.netText)}">${escapeHtml(item.netText)}</strong>
                </div>
                <div class="report-daily-bars">
                  <div class="report-daily-bar-row">
                    <span class="report-daily-bar-label">Thu</span>
                    <div class="report-daily-bar-track">
                      <span class="report-daily-bar income" style="width:${incomeWidth}"></span>
                    </div>
                    <strong class="report-daily-bar-value u-money" title="${escapeHtml(item.incomeText)}">${escapeHtml(item.incomeText)}</strong>
                  </div>
                  <div class="report-daily-bar-row">
                    <span class="report-daily-bar-label">Chi</span>
                    <div class="report-daily-bar-track">
                      <span class="report-daily-bar expense" style="width:${expenseWidth}"></span>
                    </div>
                    <strong class="report-daily-bar-value u-money" title="${escapeHtml(item.expenseText)}">${escapeHtml(item.expenseText)}</strong>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
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
    <div class="workspace-load-prompt">
      <strong>${escapeHtml(t("reports.loadTitle", "Báo cáo chi tiết"))}</strong>
      <p>${escapeHtml(t("reports.loadBody", "Chọn kỳ rồi bấm Tải báo cáo hoặc Áp dụng — không tải tự động khi mở tab."))}</p>
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
      <div class="workspace-load-prompt workspace-load-prompt-inline reports-mom-prompt">
        <strong>${escapeHtml(t("reports.momLoadTitle", "So với kỳ trước"))}</strong>
        <p>${escapeHtml(t("reports.momLoadBody", "Bấm để so sánh chi, thu và còn lại với kỳ liền trước."))}</p>
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

  const note = String(block?.prevRangeLabel || "").trim();
  container.innerHTML = `
    <div class="reports-mom-grid" aria-label="${escapeHtml(t("reports.momLoadTitle", "So với kỳ trước"))}">
      ${note ? `<p class="reports-mom-note small text-muted">${escapeHtml(note)}</p>` : ""}
      ${items
        .map(
          (item) => `
            <article class="reports-mom-card tone-${escapeHtml(item.key || "net")}">
              <span class="reports-mom-label">${escapeHtml(item.label)}</span>
              <strong class="reports-mom-current u-money">${escapeHtml(item.currentText || "0đ")}</strong>
              <span class="reports-mom-previous">Kỳ trước ${escapeHtml(item.previousText || "0đ")}</span>
              <span class="reports-mom-delta tone-${escapeHtml(item.deltaTone || "up")}">${escapeHtml(item.deltaText || "0%")}</span>
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
    metaEl.textContent = `${vm?.meta?.rangeLabel || ""} · ${vm?.meta?.transactionCountLabel || "0 giao dịch"} · ${
      vm?.meta?.accountFilterLabel || "Tất cả tài khoản"
    } · ${vm?.summary?.transferMetaText || "Chuyển khoản 0đ"} · ${vm?.meta?.exclusionNote || ""}`;
  }

  const cashMetaEl = byId("reportCashSnapshotMeta");
  if (cashMetaEl) {
    cashMetaEl.textContent = formatTemplate(t("reports.cashSnapshotSubtitle", "{{count}} ví đang dùng"), {
      count: vm?.meta?.cashSnapshotCount ?? 0,
    });
  }

  const signalsMetaEl = byId("reportQuickSignalsMeta");
  if (signalsMetaEl) signalsMetaEl.textContent = t("reports.periodSummarySubtitle", "Điểm nổi bật trong kỳ đang xem.");

  const attentionMetaEl = byId("reportAttentionMeta");
  if (attentionMetaEl) attentionMetaEl.textContent = t("reports.worthNotingSubtitle", "Gợi ý từ dữ liệu kỳ này.");

  const scopeMetaEl = byId("reportScopeBreakdownMeta");
  if (scopeMetaEl) scopeMetaEl.textContent = t("reports.scopeSubtitle", "Nhóm nào đang chi nhiều hơn.");

  if (!reportsDataLoaded) {
    renderSummary(byId("reportsSummary"), {});
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
