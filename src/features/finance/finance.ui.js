import { t } from "../../shared/constants/copy.vi.js";
import {
  ACCOUNT_TYPE_OPTIONS,
  FINANCE_CATEGORIES,
  FINANCE_TRANSACTION_TYPE_OPTIONS,
} from "../../shared/constants/finance.constants.js";

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

function renderOverview(container, summary = {}) {
  if (!container) return;
  const accountCards = Array.isArray(summary?.accountHighlights) ? summary.accountHighlights : [];

  if (accountCards.length) {
    container.innerHTML = accountCards
      .map(
        (card) => `
          <article class="finance-metric-card finance-account-highlight">
            <span class="finance-metric-label">${escapeHtml(card.typeLabel || "Tài khoản")}</span>
            <strong class="finance-metric-value">${escapeHtml(card.balanceText || "0đ")}</strong>
            <div class="finance-account-highlight-name">
              ${escapeHtml(card.name || "Không rõ")}
              ${card.isDefault ? '<span class="ledger-chip transfer">Mặc định</span>' : ""}
            </div>
            <div class="finance-metric-note">${escapeHtml(card.metaText || "")}</div>
          </article>
        `
      )
      .join("");
    return;
  }

  const cards = [
    {
      label: t("finance.summary.totalBalance", "Tổng số dư"),
      value: summary.totalBalanceText,
      note: "Tổng của các tài khoản đang dùng",
    },
    {
      label: t("finance.summary.income", "Thu trong tháng"),
      value: summary.incomeTotalText,
      note: "Chỉ tính giao dịch thu",
    },
    {
      label: t("finance.summary.expense", "Chi trong tháng"),
      value: summary.expenseTotalText,
      note: "Chỉ tính giao dịch chi",
    },
    {
      label: t("finance.summary.net", "Chênh lệch tháng"),
      value: summary.netTotalText,
      note: "Thu - Chi + Điều chỉnh",
    },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
        <article class="finance-metric-card">
          <span class="finance-metric-label">${escapeHtml(card.label)}</span>
          <strong class="finance-metric-value">${escapeHtml(card.value)}</strong>
          <div class="finance-metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderLedgerEmpty(container, title = "", body = "", hasAccounts = false) {
  if (!container) return;
  container.innerHTML = `
    <div class="finance-empty finance-empty-large">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(body)}</div>
      <button
        type="button"
        class="btn btn-primary mt-3"
        ${hasAccounts ? 'data-finance-open="expense"' : 'data-open-account-panel="true"'}
      >
        ${hasAccounts ? "Thêm giao dịch đầu tiên" : "Tạo tài khoản đầu tiên"}
      </button>
    </div>
  `;
}

function renderLedgerTimeline(container, ledger = {}, accountsPanel = {}) {
  if (!container) return;
  const groups = Array.isArray(ledger?.groups) ? ledger.groups : [];

  if (!groups.length) {
    renderLedgerEmpty(
      container,
      ledger?.emptyTitle || "",
      ledger?.emptyBody || "",
      !!accountsPanel?.hasActiveAccounts
    );
    return;
  }

  container.innerHTML = groups
    .map(
      (group) => `
        <section class="ledger-day-group">
          <header class="ledger-day-head">
            <div>
              <div class="ledger-day-title">${escapeHtml(group.dateLabel)}</div>
              <div class="ledger-day-meta">
                Thu ${escapeHtml(group.incomeTotalText)} •
                Chi ${escapeHtml(group.expenseTotalText)} •
                ${group.transferTotal > 0 ? `Chuyển ${escapeHtml(group.transferTotalText)} • ` : ""}
                Chênh lệch ${escapeHtml(group.netTotalText)}
              </div>
            </div>
            <span class="ledger-day-count">${Number(group.items?.length || 0)} giao dịch</span>
          </header>

          <div class="ledger-day-list">
            ${(Array.isArray(group.items) ? group.items : [])
              .map(
                (row) => `
                  <article class="ledger-entry">
                    <div class="ledger-entry-main">
                      <div class="ledger-entry-top">
                        <div class="ledger-item-title">${escapeHtml(row.title)}</div>
                        <span class="ledger-chip ${escapeHtml(row.typeKey)}">${escapeHtml(row.typeLabel)}</span>
                      </div>
                      <div class="ledger-entry-meta">
                        <span>${escapeHtml(row.accountLabel)}</span>
                        ${row.categoryLabel ? `<span>${escapeHtml(row.categoryLabel)}</span>` : ""}
                        ${row.scopeLabel ? `<span>Phạm vi: ${escapeHtml(row.scopeLabel)}</span>` : ""}
                      </div>
                      <div class="ledger-item-note">${escapeHtml(row.note || "Không có ghi chú")}</div>
                    </div>

                    <div class="ledger-entry-side">
                      <div class="ledger-entry-amount ${escapeHtml(row.amountClass)}">${escapeHtml(row.amountText)}</div>
                      <div class="ledger-entry-actions">
                        <button class="btn btn-sm btn-outline-primary" data-ledger-action="edit" data-id="${escapeHtml(row.id)}">
                          Sửa
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-ledger-action="delete" data-id="${escapeHtml(row.id)}">
                          Xóa
                        </button>
                      </div>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderAccounts(container, accountsPanel = {}) {
  if (!container) return;
  const activeAccounts = Array.isArray(accountsPanel?.activeAccounts) ? accountsPanel.activeAccounts : [];
  const archivedAccounts = Array.isArray(accountsPanel?.archivedAccounts) ? accountsPanel.archivedAccounts : [];

  if (!activeAccounts.length && !archivedAccounts.length) {
    container.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(accountsPanel.emptyTitle || "")}</strong>
        <div>${escapeHtml(accountsPanel.emptyBody || "")}</div>
        <button type="button" class="btn btn-primary mt-3" data-open-account-panel="true">Tạo tài khoản đầu tiên</button>
      </div>
    `;
    return;
  }

  const renderItems = (items, archived = false) =>
    items
      .map(
        (account) => `
          <article class="account-card ${archived ? "is-archived" : ""}">
            <div class="account-head">
              <div class="account-main">
                <div class="account-title">${escapeHtml(account.name)}</div>
                <div class="account-meta">
                  ${escapeHtml(account.typeLabel)} • ${escapeHtml(account.openingBalanceText)}
                </div>
                <div class="ledger-chip-row account-chip-row">
                  <span class="ledger-chip">${escapeHtml(account.statusLabel)}</span>
                  ${
                    account.isDefault
                      ? `<span class="ledger-chip transfer">${escapeHtml(
                          t("finance.account.default", "Mặc định")
                        )}</span>`
                      : ""
                  }
                </div>
              </div>
              <div class="account-balance">${escapeHtml(account.currentBalanceText)}</div>
            </div>

            <div class="account-foot">
              <div class="small text-muted">${archived ? "Tài khoản đã lưu trữ" : "Thao tác nhanh"}</div>
              <div class="account-actions">
              ${
                archived
                  ? ""
                  : `<button type="button" class="btn btn-sm btn-outline-primary" data-account-action="adjustment" data-account-id="${escapeHtml(account.id)}">Điều chỉnh</button>`
              }
              <button type="button" class="btn btn-sm btn-outline-danger" data-account-action="remove" data-account-id="${escapeHtml(account.id)}">
                ${archived ? "Xóa hẳn" : "Lưu trữ"}
              </button>
              </div>
            </div>
          </article>
        `
      )
      .join("");

  container.innerHTML = `
    <div class="accounts-list">
      ${activeAccounts.length ? renderItems(activeAccounts, false) : ""}
      ${
        archivedAccounts.length
          ? `
            <details class="accounts-archived-wrap">
              <summary>
                <span>Tài khoản đã lưu trữ</span>
                <span>${Number(accountsPanel.archivedCount || 0)}</span>
              </summary>
              <div class="accounts-archived-list">
                ${renderItems(archivedAccounts, true)}
              </div>
            </details>
          `
          : ""
      }
    </div>
  `;
}

function renderExpenseScopes(container, scopePanel = {}) {
  if (!container) return;
  const items = Array.isArray(scopePanel?.items) ? scopePanel.items : [];
  if (!items.length) {
    container.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(scopePanel.emptyTitle || "")}</strong>
        <div>${escapeHtml(scopePanel.emptyBody || "")}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="scope-list">
      ${items
        .map((item) => {
          const usageCount = Number(item.usageCount || 0);
          const usageLabel =
            usageCount > 0
              ? `${usageCount} giao dịch trong kỳ đang xem`
              : "Chưa có giao dịch nào trong kỳ đang xem";

          return `
            <article class="scope-card">
              <div class="scope-card-main">
                <div class="scope-card-title">${escapeHtml(item.name)}</div>
                <div class="scope-card-meta">${escapeHtml(usageLabel)}</div>
              </div>
              <div class="scope-card-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  data-scope-action="rename"
                  data-scope-id="${escapeHtml(item.id)}"
                  data-scope-name="${escapeHtml(item.name)}"
                  data-scope-usage-count="${usageCount}"
                >
                  Đổi tên
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  data-scope-action="delete"
                  data-scope-id="${escapeHtml(item.id)}"
                  data-scope-name="${escapeHtml(item.name)}"
                  data-scope-usage-count="${usageCount}"
                  ${item.canDelete ? "" : "disabled"}
                >
                  Xóa
                </button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderScopeBudgetManagement(container, budgetPanel = {}) {
  if (!container) return;
  const items = Array.isArray(budgetPanel?.items) ? budgetPanel.items : [];
  if (!items.length) {
    container.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(budgetPanel.emptyTitle || "")}</strong>
        <div>${escapeHtml(budgetPanel.emptyBody || "")}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="scope-list">
      ${items
        .map(
          (item) => `
            <article class="scope-card scope-budget-card">
              <div class="scope-card-main">
                <div class="scope-card-title-row">
                  <div class="scope-card-title">${escapeHtml(item.scopeName)}</div>
                  <span class="ledger-chip ${escapeHtml(item.statusTone || "transfer")}">${escapeHtml(item.statusLabel)}</span>
                </div>
                <div class="scope-card-meta">
                  ${escapeHtml(item.spentText)} / ${escapeHtml(item.limitText)} • ${escapeHtml(item.remainingText)}
                </div>
              </div>
              <div class="scope-card-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  data-budget-action="save"
                  data-budget-id="${escapeHtml(item.budgetId || "")}"
                  data-budget-scope-id="${escapeHtml(item.scopeId)}"
                  data-budget-scope-name="${escapeHtml(item.scopeName)}"
                  data-budget-limit="${escapeHtml(item.limitAmount)}"
                >
                  ${escapeHtml(item.actionLabel)}
                </button>
                ${
                  item.canDeleteBudget
                    ? `
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        data-budget-action="delete"
                        data-budget-id="${escapeHtml(item.budgetId || "")}"
                        data-budget-scope-id="${escapeHtml(item.scopeId)}"
                        data-budget-scope-name="${escapeHtml(item.scopeName)}"
                      >
                        Xóa mức
                      </button>
                    `
                    : ""
                }
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderFinanceRoute(vm = {}) {
  document.querySelectorAll("[data-finance-preset]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-finance-preset") === String(vm?.filters?.preset || "month"));
  });

  renderOverview(byId("financeOverview"), {
    totalBalanceText: vm?.summary?.totalBalanceText || "0đ",
    incomeTotalText: vm?.summary?.incomeTotalText || "0đ",
    expenseTotalText: vm?.summary?.expenseTotalText || "0đ",
    netTotalText: vm?.summary?.netTotalText || "0đ",
    accountHighlights: vm?.summary?.accountHighlights || [],
  });

  const infoEl = byId("financeLedgerInfo");
  if (infoEl) infoEl.textContent = vm?.ledger?.info || "";

  const transferMetaEl = byId("financeTransferMeta");
  if (transferMetaEl) transferMetaEl.textContent = vm?.ledger?.transferMeta || "";

  const countEl = byId("financeLedgerCount");
  if (countEl) countEl.textContent = `${Number(vm?.ledger?.count || 0)} giao dịch`;

  renderLedgerTimeline(byId("ledgerTimeline"), vm?.ledger || {}, vm?.accountsPanel || {});

  const expenseDetailsInfoEl = byId("expenseDetailsInfo");
  if (expenseDetailsInfoEl) expenseDetailsInfoEl.textContent = vm?.expenseDetails?.info || "";

  const expenseDetailsCountEl = byId("expenseDetailsCount");
  if (expenseDetailsCountEl) {
    expenseDetailsCountEl.textContent = `${Number(vm?.expenseDetails?.count || 0)} khoản chi`;
  }

  renderLedgerTimeline(byId("expenseDetailsTimeline"), vm?.expenseDetails || {}, vm?.accountsPanel || {});
  renderAccounts(byId("financeAccountsList"), vm?.accountsPanel || {});
  renderExpenseScopes(byId("expenseScopesList"), vm?.scopePanel || {});
  renderScopeBudgetManagement(byId("scopeBudgetsList"), vm?.budgetPanel || {});

  const accountsSummaryEl = byId("financeAccountsSummary");
  if (accountsSummaryEl) accountsSummaryEl.textContent = String(vm?.accountsPanel?.summaryText || "Chưa có tài khoản");

  const scopeSummaryEl = byId("expenseScopesSummary");
  if (scopeSummaryEl) scopeSummaryEl.textContent = String(vm?.scopePanel?.summaryText || "0 phạm vi");

  const budgetSummaryEl = byId("scopeBudgetsSummary");
  if (budgetSummaryEl) budgetSummaryEl.textContent = String(vm?.budgetPanel?.summaryText || "0/0 phạm vi đã đặt");

  fillSelect(
    byId("ledgerFilterAccount"),
    vm?.filtersMeta?.accountOptions || [],
    vm?.filters?.accountId || "all",
    "Tất cả tài khoản"
  );
  fillSelect(
    byId("ledgerFilterType"),
    vm?.filtersMeta?.typeOptions || [],
    vm?.filters?.type || "all",
    "Tất cả loại"
  );
  fillSelect(
    byId("ledgerFilterCategory"),
    vm?.filtersMeta?.categoryOptions || [],
    vm?.filters?.categoryKey || "all",
    "Tất cả danh mục"
  );
  fillSelect(
    byId("ledgerFilterScope"),
    vm?.filtersMeta?.scopeOptions || [],
    vm?.filters?.scopeId || "all",
    "Tất cả phạm vi"
  );

  const dayFilterEl = byId("dayFilter");
  if (dayFilterEl) dayFilterEl.value = String(vm?.filters?.date || "");

  const searchEl = byId("ledgerFilterSearch");
  if (searchEl) searchEl.value = String(vm?.filters?.search || "");
}

export function renderFinanceComposer({
  draft = {},
  accounts = [],
  expenseScopes = [],
  budgetPreview = {},
} = {}) {
  const type = String(draft?.type || "expense").trim();
  const isEdit = !!String(draft?.id || "").trim();

  const titleKeyMap = {
    expense: isEdit ? "finance.composer.editExpense" : "finance.composer.createExpense",
    income: isEdit ? "finance.composer.editIncome" : "finance.composer.createIncome",
    transfer: isEdit ? "finance.composer.editTransfer" : "finance.composer.createTransfer",
    adjustment: isEdit ? "finance.composer.editAdjustment" : "finance.composer.createAdjustment",
  };
  const hintKeyMap = {
    expense: "finance.composer.expenseHint",
    income: "finance.composer.incomeHint",
    transfer: "finance.composer.transferHint",
    adjustment: "finance.composer.adjustmentHint",
  };

  const titleEl = byId("financeComposerTitle");
  const hintEl = byId("financeComposerHint");
  if (titleEl) titleEl.textContent = t(titleKeyMap[type], "Thêm giao dịch");
  if (hintEl) hintEl.textContent = t(hintKeyMap[type], "");

  const activeAccounts = (Array.isArray(accounts) ? accounts : []).filter(
    (item) => String(item?.status || "active") !== "archived"
  );
  const accountOptions = activeAccounts.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const scopeOptions = [
    { value: "", label: "Chọn phạm vi chi" },
    ...(Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ];

  fillSelect(byId("ftType"), FINANCE_TRANSACTION_TYPE_OPTIONS, type);
  fillSelect(byId("ftAccountId"), accountOptions, draft?.accountId || "");
  fillSelect(byId("ftToAccountId"), accountOptions, draft?.toAccountId || "");
  fillSelect(byId("ftCategory"), FINANCE_CATEGORIES, draft?.categoryKey || "other");
  fillSelect(byId("ftScopeId"), scopeOptions, draft?.scopeId || "");

  byId("ftAccountWrap")?.classList.toggle("d-none", false);
  byId("ftToAccountWrap")?.classList.toggle("d-none", type !== "transfer");
  byId("ftCategoryWrap")?.classList.toggle("d-none", type !== "expense");
  byId("ftScopeWrap")?.classList.toggle("d-none", type !== "expense");

  const budgetPreviewWrap = byId("ftBudgetPreviewWrap");
  const budgetPreviewEl = byId("ftBudgetPreview");
  const showBudgetPreview = type === "expense" && !!budgetPreview?.visible;
  if (budgetPreviewWrap) budgetPreviewWrap.classList.toggle("d-none", !showBudgetPreview);
  if (budgetPreviewEl) {
    budgetPreviewEl.innerHTML = showBudgetPreview
      ? `
        <div class="composer-budget-preview ${escapeHtml(`is-${budgetPreview.statusKey || "safe"}`)}">
          <div class="composer-budget-preview-head">
            <strong>${escapeHtml(budgetPreview.scopeName || "")}</strong>
            <span class="ledger-chip ${escapeHtml(budgetPreview.statusTone || "transfer")}">${escapeHtml(
              budgetPreview.statusLabel || ""
            )}</span>
          </div>
          <div class="composer-budget-preview-meta">Tháng ${escapeHtml(budgetPreview.monthLabel || "")}</div>
          <div class="composer-budget-preview-grid">
            <span>Đã chi</span>
            <strong>${escapeHtml(budgetPreview.spentBeforeText || "0đ")}</strong>
            <span>Sau khi lưu</span>
            <strong>${escapeHtml(budgetPreview.spentAfterText || "0đ")}</strong>
            <span>Ngân sách</span>
            <strong>${escapeHtml(budgetPreview.limitText || "Chưa đặt")}</strong>
            <span>Còn lại</span>
            <strong>${escapeHtml(budgetPreview.remainingAfterText || "Chưa đặt ngân sách")}</strong>
          </div>
          <div class="composer-budget-preview-note">${escapeHtml(budgetPreview.warningText || "")}</div>
        </div>
      `
      : "";
  }

  const amountInput = byId("ftAmount");
  const occurredAtInput = byId("ftOccurredAt");
  const noteInput = byId("ftNote");
  const idInput = byId("ftId");
  if (amountInput) amountInput.value = draft?.amount ?? "";
  if (occurredAtInput) occurredAtInput.value = draft?.occurredAt || "";
  if (noteInput) noteInput.value = draft?.note || "";
  if (idInput) idInput.value = draft?.id || "";
}

export function resetFinanceAccountForm() {
  const nameEl = byId("faName");
  const typeEl = byId("faType");
  const openingEl = byId("faOpeningBalance");
  const defaultEl = byId("faDefault");
  if (nameEl) nameEl.value = "";
  fillSelect(typeEl, ACCOUNT_TYPE_OPTIONS, "bank");
  if (openingEl) openingEl.value = "0";
  if (defaultEl) defaultEl.checked = false;
}

export function renderFinanceBudgetForm({ draft = {}, expenseScopes = [] } = {}) {
  const isEdit = !!String(draft?.id || "").trim();

  const titleEl = byId("financeBudgetTitle");
  const hintEl = byId("financeBudgetHint");
  const saveButton = byId("btnSaveFinanceBudget");

  if (titleEl) titleEl.textContent = isEdit ? "Sửa ngân sách tháng" : "Đặt ngân sách tháng";
  if (hintEl) {
    hintEl.textContent = isEdit
      ? "Cập nhật hạn mức chi cho phạm vi đang chọn trong tháng này."
      : "Chọn phạm vi chi và nhập mức chi tối đa cho tháng đang xem.";
  }
  if (saveButton) saveButton.textContent = isEdit ? "Lưu thay đổi" : "Lưu ngân sách";

  const scopeOptions = (Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => ({
    value: item.id,
    label: item.name,
  }));

  fillSelect(byId("fbScopeId"), scopeOptions, draft?.scopeId || "");

  const idEl = byId("fbId");
  const monthEl = byId("fbMonthLabel");
  const limitEl = byId("fbLimitAmount");
  if (idEl) idEl.value = draft?.id || "";
  if (monthEl) monthEl.value = draft?.monthLabel || "";
  if (limitEl) limitEl.value = draft?.limitAmount ?? "";
}

export function renderExpenseScopeForm({ draft = {}, expenseScopes = [] } = {}) {
  const mode = String(draft?.mode || "rename").trim();
  const isDelete = mode === "delete";

  const titleEl = byId("financeScopeTitle");
  const hintEl = byId("financeScopeHint");
  const saveButton = byId("btnSaveExpenseScope");

  if (titleEl) titleEl.textContent = isDelete ? "Xóa phạm vi chi" : "Đổi tên phạm vi chi";
  if (hintEl) {
    hintEl.textContent = isDelete
      ? "Chọn phạm vi thay thế nếu cần chuyển giao dịch hoặc ngân sách trước khi xóa."
      : "Đổi tên phạm vi chi mà không làm mất liên kết với các khoản chi cũ.";
  }
  if (saveButton) {
    saveButton.textContent = isDelete ? "Xóa phạm vi" : "Lưu thay đổi";
    saveButton.classList.toggle("btn-danger", isDelete);
    saveButton.classList.toggle("btn-primary", !isDelete);
  }

  byId("fsNameWrap")?.classList.toggle("d-none", isDelete);
  byId("fsCurrentWrap")?.classList.toggle("d-none", !isDelete);
  byId("fsReplacementWrap")?.classList.toggle("d-none", !isDelete);
  byId("fsDeleteNoticeWrap")?.classList.toggle("d-none", !isDelete);

  const idEl = byId("fsId");
  const modeEl = byId("fsMode");
  const currentEl = byId("fsCurrentName");
  const nameEl = byId("fsName");
  const deleteNoticeEl = byId("fsDeleteNotice");

  if (idEl) idEl.value = draft?.id || "";
  if (modeEl) modeEl.value = mode;
  if (currentEl) currentEl.value = draft?.name || "";
  if (nameEl) nameEl.value = draft?.name || "";
  if (deleteNoticeEl) {
    deleteNoticeEl.textContent = isDelete
      ? `Phạm vi "${draft?.name || ""}" sẽ bị xóa sau khi chuyển dữ liệu sang phạm vi thay thế.`
      : "";
  }

  const replacementOptions = (Array.isArray(expenseScopes) ? expenseScopes : [])
    .filter((item) => String(item?.id || "").trim() !== String(draft?.id || "").trim())
    .map((item) => ({
      value: item.id,
      label: item.name,
    }));

  fillSelect(byId("fsReplacementScopeId"), replacementOptions, draft?.replacementScopeId || "");
  if (saveButton) saveButton.disabled = isDelete && replacementOptions.length === 0;
}
