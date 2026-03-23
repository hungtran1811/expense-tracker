import { buildDefaultReportFilters } from "./reports.controller.js";

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

function renderSummary(container, summary = {}) {
  if (!container) return;
  const cards = [
    {
      label: "Thu",
      value: summary.incomeTotalText || "0đ",
      note: `${summary.transactionCount || 0} giao dịch`,
      tone: "income",
    },
    {
      label: "Chi",
      value: summary.expenseTotalText || "0đ",
      note: "Khoản chi trong kỳ",
      tone: "expense",
    },
    {
      label: "Chênh lệch",
      value: summary.netTotalText || "0đ",
      note: summary.adjustmentMetaText || "Thu - Chi + Điều chỉnh",
      tone: "net",
    },
    {
      label: "Chuyển khoản",
      value: summary.transferTotalText || "0đ",
      note: "Theo dõi riêng",
      tone: "transfer",
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

function renderCategoryBreakdown(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "", breakdown?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-table">
      <div class="report-table-head report-table-grid-category">
        <span>Danh mục</span>
        <span>Giao dịch</span>
        <span>Tỷ trọng</span>
        <span>Tổng chi</span>
      </div>
      <div class="report-table-body">
        ${items
          .map(
            (item) => `
              <article class="report-table-row report-table-grid-category">
                <div class="report-table-main">
                  <div class="report-table-title">${escapeHtml(item.label)}</div>
                  <div class="report-inline-bar">
                    <span style="width:${escapeHtml(item.barWidth)}"></span>
                  </div>
                </div>
                <div class="report-table-value">${escapeHtml(item.count)}</div>
                <div class="report-table-value">${escapeHtml(item.shareText)}</div>
                <div class="report-table-value strong">${escapeHtml(item.totalText)}</div>
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

  container.innerHTML = `
    <div class="report-table">
      <div class="report-table-head report-table-grid-account">
        <span>Tài khoản</span>
        <span>Vào</span>
        <span>Ra</span>
        <span>Ròng</span>
        <span>Số dư</span>
      </div>
      <div class="report-table-body">
        ${items
          .map(
            (item) => `
              <article class="report-table-row report-table-grid-account">
                <div class="report-table-main">
                  <div class="report-table-title">
                    ${escapeHtml(item.name)}
                    ${item.isArchived ? '<span class="ledger-chip">Đã lưu trữ</span>' : ""}
                  </div>
                  <div class="report-table-sub">${escapeHtml(item.typeLabel)}</div>
                </div>
                <div class="report-table-value">${escapeHtml(item.inflowText)}</div>
                <div class="report-table-value">${escapeHtml(item.outflowText)}</div>
                <div class="report-table-value ${item.net >= 0 ? "positive" : "negative"}">${escapeHtml(
                  item.netText
                )}</div>
                <div class="report-table-value strong">${escapeHtml(item.currentBalanceText)}</div>
              </article>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderScopeBreakdown(container, breakdown = {}) {
  if (!container) return;
  const items = Array.isArray(breakdown?.items) ? breakdown.items : [];
  if (!items.length) {
    renderEmptyBlock(container, breakdown?.emptyTitle || "", breakdown?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="report-table">
      <div class="report-table-head report-table-grid-scope">
        <span>Phạm vi</span>
        <span>Giao dịch</span>
        <span>Tỷ trọng</span>
        <span>Tổng chi</span>
      </div>
      <div class="report-table-body">
        ${items
          .map(
            (item) => `
              <article class="report-table-row report-table-grid-scope">
                <div class="report-table-main">
                  <div class="report-table-title">${escapeHtml(item.label)}</div>
                  <div class="report-inline-bar">
                    <span style="width:${escapeHtml(item.barWidth)}"></span>
                  </div>
                </div>
                <div class="report-table-value">${escapeHtml(item.count)}</div>
                <div class="report-table-value">${escapeHtml(item.shareText)}</div>
                <div class="report-table-value strong">${escapeHtml(item.totalText)}</div>
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
    <div class="report-table">
      <div class="report-table-head report-table-grid-budget">
        <span>Phạm vi</span>
        <span>Ngân sách</span>
        <span>Đã chi</span>
        <span>Còn lại</span>
        <span>% dùng</span>
        <span>Trạng thái</span>
      </div>
      <div class="report-table-body">
        ${items
          .map(
            (item) => `
              <article class="report-table-row report-table-grid-budget">
                <div class="report-table-main">
                  <div class="report-table-title">${escapeHtml(item.scopeName)}</div>
                  <div class="report-inline-bar">
                    <span style="width:${escapeHtml(item.progressWidth || "0%")}"></span>
                  </div>
                </div>
                <div class="report-table-value">${escapeHtml(item.limitText)}</div>
                <div class="report-table-value">${escapeHtml(item.spentText)}</div>
                <div class="report-table-value ${escapeHtml(item.statusKey === "over" ? "negative" : item.statusKey === "near" ? "warning" : "")}">
                  ${escapeHtml(item.remainingText)}
                </div>
                <div class="report-table-value">${escapeHtml(item.percentText)}</div>
                <div class="report-table-value">
                  <span class="ledger-chip ${escapeHtml(item.statusTone || "transfer")}">${escapeHtml(item.statusLabel)}</span>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
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
    <div class="report-table">
      <div class="report-table-head report-table-grid-daily">
        <span>Ngày</span>
        <span>Thu</span>
        <span>Chi</span>
        <span>Ròng</span>
        <span>Chuyển</span>
      </div>
      <div class="report-table-body">
        ${activeItems
          .map(
            (item) => `
              <article class="report-table-row report-table-grid-daily">
                <div class="report-table-main">
                  <div class="report-table-title">${escapeHtml(item.dateLabel)}</div>
                </div>
                <div class="report-table-value">${escapeHtml(item.incomeText)}</div>
                <div class="report-table-value">${escapeHtml(item.expenseText)}</div>
                <div class="report-table-value ${escapeHtml(item.netClass)}">${escapeHtml(item.netText)}</div>
                <div class="report-table-value">${escapeHtml(item.transferText)}</div>
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
    metaEl.textContent = `${vm?.meta?.rangeLabel || ""} • ${vm?.meta?.transactionCountLabel || "0 giao dịch"} • ${
      vm?.meta?.accountFilterLabel || "Tất cả tài khoản"
    }`;
  }

  renderSummary(byId("reportsSummary"), vm?.summary || {});
  renderCategoryBreakdown(byId("reportCategoryBreakdown"), vm?.categoryBreakdown || {});
  renderAccountBreakdown(byId("reportAccountBreakdown"), vm?.accountBreakdown || {});
  renderBudgetComparison(byId("reportBudgetComparison"), vm?.budgetComparison || {});
  renderScopeBreakdown(byId("reportScopeBreakdown"), vm?.scopeBreakdown || {});
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
