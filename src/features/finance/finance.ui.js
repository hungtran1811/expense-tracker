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

function renderFinanceMonthLoadPrompt(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="workspace-load-prompt workspace-load-prompt-inline">
      <strong>${escapeHtml(t("finance.monthLoadTitle", "Giao dịch tháng này"))}</strong>
      <p>${escapeHtml(t("finance.monthLoadBody", "Bấm tải để xem toàn bộ giao dịch trong tháng — mặc định trang Chi tiêu chỉ hiển thị theo ngày."))}</p>
      <button type="button" class="btn btn-sm btn-primary" id="btnLoadFinanceMonth">
        ${escapeHtml(t("finance.monthLoadAction", "Tải giao dịch tháng"))}
      </button>
    </div>
  `;
}

function renderLedgerTimeline(container, ledger = {}, accountsPanel = {}, options = {}) {
  if (!container) return;

  if (options?.monthLoadPending) {
    renderFinanceMonthLoadPrompt(container);
    return;
  }

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
              <div class="ledger-day-meta u-ellipsis" title="Thu ${escapeHtml(group.incomeTotalText)} • Chi ${escapeHtml(group.expenseTotalText)}${group.transferTotal > 0 ? ` • Chuyển ${escapeHtml(group.transferTotalText)}` : ""} • Còn lại ${escapeHtml(group.netTotalText)}">
                Thu ${escapeHtml(group.incomeTotalText)} •
                Chi ${escapeHtml(group.expenseTotalText)} •
                ${group.transferTotal > 0 ? `Chuyển ${escapeHtml(group.transferTotalText)} • ` : ""}
                Còn lại ${escapeHtml(group.netTotalText)}
              </div>
            </div>
            <span class="ledger-day-count">${Number(group.items?.length || 0)} giao dịch</span>
          </header>

          <div class="ledger-day-list">
            ${(Array.isArray(group.items) ? group.items : [])
              .map(
                (row) => `
                  <article class="ledger-entry ledger-entry-clickable">
                    <div class="ledger-entry-main" data-ledger-main data-id="${escapeHtml(row.id)}" title="Bấm để sửa">
                      <div class="ledger-entry-top">
                        <div class="ledger-item-title">${escapeHtml(row.title)}</div>
                        <span class="ledger-chip ${escapeHtml(row.typeKey)}">${escapeHtml(row.typeLabel)}</span>
                      </div>
                      <div class="ledger-entry-meta">
                        <span>${escapeHtml(row.accountLabel)}</span>
                        ${row.categoryLabel ? `<span>${escapeHtml(row.categoryLabel)}</span>` : ""}
                        ${row.scopeLabel ? `<span>Nhóm: ${escapeHtml(row.scopeLabel)}</span>` : ""}
                      </div>
                      <div class="ledger-item-note">${escapeHtml(row.note || "Không có ghi chú")}</div>
                    </div>

                    <div class="ledger-entry-side">
                      <div class="ledger-entry-amount u-money ${escapeHtml(row.amountClass)}" title="${escapeHtml(row.amountText)}">${escapeHtml(row.amountText)}</div>
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
              <div class="account-balance u-money" title="${escapeHtml(account.currentBalanceText)}">${escapeHtml(account.currentBalanceText)}</div>
            </div>

            <div class="account-foot">
              <div class="small text-muted">${archived ? "Tài khoản đã lưu trữ" : "Thao tác nhanh"}</div>
              <div class="account-actions">
              ${
                archived
                  ? ""
                  : `
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-account-action="edit" data-account-id="${escapeHtml(account.id)}">Sửa</button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-account-action="adjustment" data-account-id="${escapeHtml(account.id)}">Sửa số dư</button>
                  `
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

function syncFilterControlLabels() {
  const labelMap = {
    ledgerFilterAccount: t("finance.filter.account", "Tài khoản"),
    ledgerFilterType: t("finance.filter.type", "Loại"),
    ledgerFilterCategory: t("finance.filter.category", "Danh mục"),
    ledgerFilterScope: t("finance.filter.scope", "Nhóm chi"),
  };

  Object.entries(labelMap).forEach(([controlId, label]) => {
    const control = byId(controlId)?.closest("[data-filter-control]");
    const labelEl = control?.querySelector(".filter-control-label");
    if (labelEl) labelEl.textContent = label;
  });

  const drawer = byId("ledgerFilterDrawer");
  const drawerLabel = drawer?.querySelector(".filter-drawer-summary > span:not(.filter-drawer-hint)");
  if (drawerLabel) drawerLabel.textContent = t("finance.filterDrawer", "Bộ lọc");
  const drawerHint = drawer?.querySelector(".filter-drawer-hint");
  if (drawerHint) drawerHint.textContent = t("finance.filterDrawerHint", "Tài khoản, loại, danh mục...");

  const searchEl = byId("ledgerFilterSearch");
  if (searchEl) searchEl.placeholder = t("finance.filter.searchPlaceholder", "Tìm ghi chú, tài khoản... (/ để focus)");
}

export function renderExpensesLedgerView(vm = {}, options = {}) {
  const preset = String(vm?.filters?.preset || "today").trim();
  const monthLoadPending = preset === "month" && options?.financeMonthLoaded === false;

  document.querySelectorAll("[data-finance-preset]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-finance-preset") === preset);
  });

  const infoEl = byId("financeLedgerInfo");
  if (infoEl) {
    infoEl.textContent = monthLoadPending
      ? t("finance.monthLoadLedgerInfo", "Đang xem theo ngày. Tải tháng để xem toàn bộ giao dịch trong kỳ.")
      : vm?.ledger?.info || t("finance.ledgerInfo", "Giao dịch trong kỳ đang xem.");
  }

  const transferMetaEl = byId("financeTransferMeta");
  if (transferMetaEl) transferMetaEl.textContent = monthLoadPending ? "" : vm?.ledger?.transferMeta || "";

  const countEl = byId("financeLedgerCount");
  if (countEl) {
    countEl.textContent = monthLoadPending ? "—" : `${Number(vm?.ledger?.count || 0)} giao dịch`;
  }

  renderLedgerTimeline(byId("ledgerTimeline"), vm?.ledger || {}, vm?.accountsPanel || {}, {
    monthLoadPending,
  });

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
    t("finance.filter.allScopes", "Tất cả nhóm")
  );

  const dayFilterEl = byId("dayFilter");
  if (dayFilterEl) dayFilterEl.value = String(vm?.filters?.date || "");

  const searchEl = byId("ledgerFilterSearch");
  if (searchEl) searchEl.value = String(vm?.filters?.search || "");

  syncFilterControlLabels();
}

export function renderExpensesManageView(vm = {}) {
  renderAccounts(byId("financeAccountsList"), vm?.accountsPanel || {});

  const syncNoteEl = byId("financeAccountsSyncNote");
  if (syncNoteEl) syncNoteEl.textContent = t("finance.accountsSyncNote", "Số dư hiện tại được đồng bộ từ giao dịch.");

  renderExpenseScopes(byId("expenseScopesList"), vm?.scopePanel || {});

  const scopeHintEl = byId("expenseScopesHint");
  if (scopeHintEl) scopeHintEl.textContent = t("finance.scopeHint", "Tách khoản chi theo người hoặc mục đích.");

  const scopeSummaryEl = byId("expenseScopesSummary");
  if (scopeSummaryEl) scopeSummaryEl.textContent = String(vm?.scopePanel?.summaryText || "0 nhóm");

  const scopeNameInput = byId("expenseScopeName");
  if (scopeNameInput) {
    scopeNameInput.placeholder = t("finance.scopePlaceholder", "Ví dụ: Tôi, Gia đình, Thuê nhà");
  }

  const createScopeBtn = byId("btnCreateExpenseScope");
  if (createScopeBtn) createScopeBtn.textContent = t("finance.scope.create", "Thêm nhóm");
}

export function renderFinanceRoute(vm = {}, expensesView = "ledger", options = {}) {
  const view = expensesView === "manage" ? "manage" : "ledger";

  document.querySelectorAll("[data-expenses-tab]").forEach((link) => {
    const tab = link.getAttribute("data-expenses-tab") || "ledger";
    link.classList.toggle("active", tab === view);
  });

  const ledgerView = byId("expensesLedgerView");
  const manageView = byId("expensesManageView");
  if (ledgerView) ledgerView.classList.toggle("d-none", view !== "ledger");
  if (manageView) manageView.classList.toggle("d-none", view !== "manage");

  document.querySelectorAll(".expenses-subnav-btn").forEach((link) => {
    const tab = link.getAttribute("data-expenses-tab") || "ledger";
    link.textContent =
      tab === "manage"
        ? t("finance.subTab.manage", "Quản lý")
        : t("finance.subTab.ledger", "Giao dịch");
  });

  renderExpensesLedgerView(vm, options);
  renderExpensesManageView(vm);
}

export function renderFinanceComposer({
  draft = {},
  accounts = [],
  expenseScopes = [],
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
    { value: "", label: t("finance.filter.pickScope", "Chọn nhóm chi") },
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

  const amountInput = byId("ftAmount");
  const occurredAtInput = byId("ftOccurredAt");
  const noteInput = byId("ftNote");
  const idInput = byId("ftId");
  if (amountInput) amountInput.value = draft?.amount ?? "";
  if (occurredAtInput) occurredAtInput.value = draft?.occurredAt || "";
  if (noteInput) noteInput.value = draft?.note || "";
  if (idInput) idInput.value = draft?.id || "";

  const shortcutsEl = byId("financeComposerShortcuts");
  if (shortcutsEl) {
    if (type === "expense") {
      shortcutsEl.classList.remove("d-none");
      shortcutsEl.innerHTML =
        'Phím tắt: <kbd>C</kbd> mở form chi nhanh (tab Tổng quan hoặc Chi tiêu) · <kbd>/</kbd> tìm trong sổ (tab Chi tiêu)';
    } else if (type === "income") {
      shortcutsEl.classList.remove("d-none");
      shortcutsEl.innerHTML =
        'Phím tắt: <kbd>I</kbd> mở form thu nhanh (tab Tổng quan hoặc Chi tiêu)';
    } else {
      shortcutsEl.classList.add("d-none");
      shortcutsEl.textContent = "";
    }
  }
}

export function renderFinanceAccountForm({ draft = {}, mode = "create" } = {}) {
  const isEdit = mode === "edit" || !!String(draft?.id || "").trim();

  const titleEl = byId("financeAccountTitle");
  const hintEl = byId("financeAccountHint");
  const saveButton = byId("btnSaveFinanceAccount");
  const openingWrap = byId("faOpeningBalanceWrap");

  if (titleEl) {
    titleEl.textContent = isEdit
      ? t("finance.account.editTitle", "Sửa tài khoản")
      : t("finance.account.createTitle", "Thêm tài khoản");
  }
  if (hintEl) {
    hintEl.textContent = isEdit
      ? t(
          "finance.account.editHint",
          "Cập nhật tên, loại hoặc trạng thái mặc định. Để sửa số dư, dùng Điều chỉnh."
        )
      : t("finance.account.createHint", "Số dư đầu kỳ chỉ nhập một lần khi tạo tài khoản.");
  }
  if (saveButton) {
    saveButton.textContent = isEdit
      ? t("finance.account.saveChanges", "Lưu thay đổi")
      : t("finance.account.createAction", "Tạo tài khoản");
  }
  if (openingWrap) openingWrap.classList.toggle("d-none", isEdit);

  const idEl = byId("faId");
  const nameEl = byId("faName");
  const typeEl = byId("faType");
  const openingEl = byId("faOpeningBalance");
  const defaultEl = byId("faDefault");

  if (idEl) idEl.value = draft?.id || "";
  if (nameEl) nameEl.value = draft?.name || "";
  fillSelect(typeEl, ACCOUNT_TYPE_OPTIONS, draft?.type || "bank");
  if (!isEdit && openingEl) openingEl.value = draft?.openingBalance ?? "0";
  if (defaultEl) defaultEl.checked = !!draft?.isDefault;
}

export function resetFinanceAccountForm() {
  renderFinanceAccountForm({ draft: {}, mode: "create" });
}

export function renderExpenseScopeForm({ draft = {}, expenseScopes = [] } = {}) {
  const mode = String(draft?.mode || "rename").trim();
  const isDelete = mode === "delete";

  const titleEl = byId("financeScopeTitle");
  const hintEl = byId("financeScopeHint");
  const saveButton = byId("btnSaveExpenseScope");

  if (titleEl) {
    titleEl.textContent = isDelete
      ? t("finance.scope.deleteTitle", "Xóa nhóm chi")
      : t("finance.scope.renameTitle", "Đổi tên nhóm chi");
  }
  if (hintEl) {
    hintEl.textContent = isDelete
      ? t("finance.scope.deleteHint", "Chọn nhóm thay thế nếu cần chuyển giao dịch trước khi xóa.")
      : t("finance.scope.renameHint", "Đổi tên nhóm mà không làm mất liên kết với các khoản chi cũ.");
  }
  if (saveButton) {
    saveButton.textContent = isDelete ? t("finance.scope.deleteAction", "Xóa nhóm") : t("common.save", "Lưu thay đổi");
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
      ? `Nhóm "${draft?.name || ""}" sẽ bị xóa sau khi chuyển dữ liệu sang nhóm thay thế.`
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
