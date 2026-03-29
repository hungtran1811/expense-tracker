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

function renderEmptyBlock(container, title = "", body = "") {
  if (!container) return;
  container.innerHTML = `
    <div class="finance-empty">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(body)}</div>
    </div>
  `;
}

function renderCashSnapshot(container, snapshot = {}) {
  if (!container) return;
  const items = Array.isArray(snapshot?.accounts) ? snapshot.accounts : [];
  container.innerHTML = `
    <article class="overview-total-card">
      <span class="finance-metric-label">Tổng tiền hiện có</span>
      <strong class="finance-metric-value">${escapeHtml(snapshot?.totalBalanceText || "0đ")}</strong>
      <div class="finance-metric-note">Tổng số dư khả dụng.</div>
    </article>
    ${items
      .map(
        (item) => `
          <article class="overview-balance-card">
            <div class="overview-balance-top">
              <strong>${escapeHtml(item.name)}</strong>
              ${item.isDefault ? '<span class="ledger-chip transfer">Mặc định</span>' : ""}
            </div>
            <div class="overview-balance-value">${escapeHtml(item.balanceText)}</div>
            <div class="overview-balance-note">${escapeHtml(item.metaText)}</div>
          </article>
        `
      )
      .join("")}
  `;
}

function renderAlertCards(container, items = []) {
  if (!container) return;
  if (!items.length) {
    renderEmptyBlock(
      container,
      "Chưa có tín hiệu cảnh báo mạnh",
      "Các tín hiệu quan trọng như vượt ngân sách, phạm vi chi mạnh hoặc tài khoản chi ra lớn sẽ hiện ở đây."
    );
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="overview-insight-card ${escapeHtml(item.tone || "neutral")}">
          <div class="overview-insight-label">${escapeHtml(item.title)}</div>
          <strong class="overview-insight-value">${escapeHtml(item.valueText)}</strong>
          <div class="overview-insight-note">${escapeHtml(item.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderTrendComparison(container, items = []) {
  if (!container) return;
  container.innerHTML = (Array.isArray(items) ? items : [])
    .map(
      (item) => `
        <article class="overview-trend-card">
          <span class="finance-metric-label">${escapeHtml(item.label)}</span>
          <strong class="finance-metric-value">${escapeHtml(item.valueText)}</strong>
          <div class="overview-trend-meta">
            <span>${escapeHtml(item.compareText)}</span>
            <span class="overview-delta ${escapeHtml(item.deltaTone || "up")}">${escapeHtml(item.deltaText)} • ${escapeHtml(item.deltaPercentText)}</span>
          </div>
          <div class="finance-metric-note">${escapeHtml(item.hint)}</div>
        </article>
      `
    )
    .join("");
}

function renderBreakdown(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmptyBlock(container, block?.emptyTitle || "", block?.emptyBody || "");
    return;
  }

  container.innerHTML = items
    .map(
      (item, index) => `
        <article class="overview-list-row">
          <div class="overview-list-main">
            <div class="overview-list-rank">${index + 1}</div>
            <div>
              <div class="overview-list-title">${escapeHtml(item.label)}</div>
              <div class="overview-list-meta">${escapeHtml(item.count)} GD • ${escapeHtml(item.shareText)}</div>
            </div>
          </div>
          <strong class="overview-list-value">${escapeHtml(item.totalText)}</strong>
        </article>
      `
    )
    .join("");
}

function renderLargestExpenses(container, block = {}) {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmptyBlock(container, block?.emptyTitle || "", block?.emptyBody || "");
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="overview-expense-row">
          <div class="overview-expense-main">
            <div class="overview-list-title">${escapeHtml(item.title)}</div>
            <div class="overview-list-meta">${escapeHtml(item.dateLabel)} • ${escapeHtml(item.accountLabel)} • ${escapeHtml(item.scopeLabel)}</div>
            ${item.note ? `<div class="overview-expense-note">${escapeHtml(item.note)}</div>` : ""}
          </div>
          <strong class="overview-list-value negative">${escapeHtml(item.amountText)}</strong>
        </article>
      `
    )
    .join("");
}

function renderAttentionList(container, items = []) {
  if (!container) return;
  if (!items.length) {
    renderEmptyBlock(
      container,
      "Chưa có việc cần chú ý",
      "Khi có khoản chi lớn, phạm vi gần chạm ngân sách hoặc tài khoản biến động mạnh, phần này sẽ tóm tắt ngay."
    );
    return;
  }

  container.innerHTML = `
    <div class="overview-attention-list">
      ${items
        .map(
          (item) => `
            <article class="overview-attention-item">
              <i class="bi bi-dot"></i>
              <span>${escapeHtml(item)}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderOverviewRoute(vm = {}, options = {}) {
  const filters = options?.draftFilters || vm?.filters || {};
  const error = String(options?.error || "").trim();
  const isCustom = String(filters?.preset || "") === "custom";

  document.querySelectorAll("[data-overview-preset]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-overview-preset") === String(filters?.preset || "30d"));
  });

  const fromWrap = byId("overviewFromWrap");
  if (fromWrap) fromWrap.classList.toggle("d-none", !isCustom);

  const fromDateEl = byId("overviewFromDate");
  const toDateEl = byId("overviewToDate");
  if (fromDateEl) fromDateEl.value = String(filters?.fromDate || "");
  if (toDateEl) toDateEl.value = String(filters?.toDate || "");

  const errorEl = byId("overviewFilterError");
  if (errorEl) {
    errorEl.textContent = error;
    errorEl.classList.toggle("d-none", !error);
  }

  const infoEl = byId("overviewFilterInfo");
  if (infoEl) {
    infoEl.textContent = `${vm?.meta?.presetLabel || ""} • ${vm?.meta?.rangeLabel || ""} • ${vm?.meta?.transactionCountLabel || ""}`;
  }

  renderCashSnapshot(byId("overviewCashSnapshot"), vm?.cashSnapshot || {});
  renderAlertCards(byId("overviewAlerts"), vm?.alerts || []);
  renderTrendComparison(byId("overviewTrendComparison"), vm?.trendComparison || []);
  renderBreakdown(byId("overviewTopCategories"), vm?.topCategories || {});
  renderBreakdown(byId("overviewTopScopes"), vm?.topScopes || {});
  renderLargestExpenses(byId("overviewLargestExpenses"), vm?.largestExpenses || {});
  renderAttentionList(byId("overviewAttentionItems"), vm?.attentionItems || []);

  const emptyEl = byId("overviewEmptyState");
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
