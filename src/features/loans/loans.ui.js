import { LOAN_TRANSACTION_TYPE_OPTIONS } from "../../shared/constants/finance.constants.js";
import { formatCurrency } from "../finance/finance.controller.js";

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
    options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  }
  items.forEach((item) => {
    const value = String(item?.value ?? item?.key ?? "").trim();
    const label = String(item?.label ?? item?.name ?? "").trim();
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  });
  selectEl.innerHTML = options.join("");
  selectEl.value = String(selectedValue || "").trim();
}

function renderEmpty(container, title = "", body = "") {
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
    { label: "Tổng còn nợ", value: summary.totalOutstandingText || "0đ", tone: "net" },
    { label: "Người đang nợ", value: summary.activePartyCountText || "0 người", tone: "transfer" },
    { label: "Đã cho mượn", value: summary.lentTotalText || "0đ", tone: "expense" },
    { label: "Đã nhận trả", value: summary.repaidTotalText || "0đ", tone: "income" },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
        <article class="finance-metric-card report-metric-card ${escapeHtml(card.tone)}">
          <span class="finance-metric-label">${escapeHtml(card.label)}</span>
          <strong class="finance-metric-value">${escapeHtml(card.value)}</strong>
        </article>
      `
    )
    .join("");
}

function renderPartyList(container, block = {}, selectedPartyId = "") {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmpty(container, block?.emptyTitle || "", block?.emptyBody || "");
    return;
  }

  container.innerHTML = `
    <div class="loan-party-list">
      ${items
        .map(
          (item) => `
            <article class="loan-party-card ${item.id === selectedPartyId ? "is-active" : ""}">
              <button type="button" class="loan-party-main" data-loan-action="select-party" data-party-id="${escapeHtml(item.id)}">
                <div class="loan-party-head">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="loan-party-outstanding">${escapeHtml(item.outstandingText)}</span>
                </div>
                <div class="loan-party-meta">
                  ${(Array.isArray(item.metaItems) ? item.metaItems : [])
                    .map((label) => `<span>${escapeHtml(label)}</span>`)
                    .join("")}
                </div>
                ${
                  item.note
                    ? `<div class="loan-party-note">${escapeHtml(item.note)}</div>`
                    : ""
                }
              </button>
              <div class="loan-party-actions">
                <button type="button" class="btn btn-sm btn-outline-primary" data-loan-action="edit-party" data-party-id="${escapeHtml(item.id)}">
                  Sửa
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  data-loan-action="delete-party"
                  data-party-id="${escapeHtml(item.id)}"
                  ${item.canDelete ? "" : "disabled"}
                >
                  Xóa
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTimeline(container, vm = {}) {
  if (!container) return;
  const selectedParty = vm?.selectedParty || null;
  const groups = Array.isArray(vm?.timeline?.groups) ? vm.timeline.groups : [];
  if (!selectedParty || !groups.length) {
    renderEmpty(
      container,
      vm?.timeline?.emptyTitle || "",
      vm?.timeline?.emptyBody || ""
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
            </div>
            <span class="ledger-day-count">${Number(group.items?.length || 0)} giao dịch</span>
          </header>

          <div class="ledger-day-list">
            ${(Array.isArray(group.items) ? group.items : [])
              .map(
                (row) => `
                  <article class="ledger-entry loan-entry">
                    <div class="ledger-entry-main">
                      <div class="ledger-entry-top">
                        <div class="ledger-item-title">${escapeHtml(row.typeLabel)}</div>
                        <span class="ledger-chip ${escapeHtml(row.type)}">${escapeHtml(row.accountLabel)}</span>
                      </div>
                      ${
                        Array.isArray(row.metaItems) && row.metaItems.length
                          ? `<div class="ledger-entry-meta">${row.metaItems
                              .map((item) => `<span>${escapeHtml(item)}</span>`)
                              .join("")}</div>`
                          : ""
                      }
                      <div class="ledger-item-note">${escapeHtml(row.note || "Không có ghi chú")}</div>
                    </div>

                    <div class="ledger-entry-side">
                      <div class="ledger-entry-amount ${escapeHtml(row.amountClass)}">${escapeHtml(row.amountText)}</div>
                      <div class="ledger-entry-actions">
                        <button class="btn btn-sm btn-outline-primary" data-loan-action="edit-entry" data-entry-id="${escapeHtml(row.id)}">
                          Sửa
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-loan-action="delete-entry" data-entry-id="${escapeHtml(row.id)}">
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

export function renderLoanPartyForm({ draft = {} } = {}) {
  const titleEl = byId("loanPartyTitle");
  if (titleEl) titleEl.textContent = String(draft?.id || "").trim() ? "Sửa người mượn" : "Thêm người mượn";

  const idEl = byId("lpId");
  const nameEl = byId("lpName");
  const noteEl = byId("lpNote");
  if (idEl) idEl.value = draft?.id || "";
  if (nameEl) nameEl.value = draft?.name || "";
  if (noteEl) noteEl.value = draft?.note || "";
}

export function renderLoanEntryForm({ draft = {}, parties = [], accounts = [], context = {} } = {}) {
  const titleEl = byId("loanEntryTitle");
  const hintEl = byId("loanEntryHint");
  const isRepay = String(draft?.type || "").trim() === "loan_repay";
  if (titleEl) {
    titleEl.textContent = String(draft?.id || "").trim()
      ? isRepay
        ? "Sửa nhận trả"
        : "Sửa cho mượn"
      : isRepay
        ? "Nhận trả"
        : "Cho mượn";
  }
  if (hintEl) {
    hintEl.textContent = isRepay
      ? "Khoản này sẽ tăng lại số dư tài khoản nhận tiền."
      : "Khoản này sẽ trừ trực tiếp khỏi số dư tài khoản bạn chọn.";
  }

  fillSelect(byId("leType"), LOAN_TRANSACTION_TYPE_OPTIONS, draft?.type || "loan_lend");
  fillSelect(byId("leLoanPartyId"), parties, draft?.loanPartyId || "", "Chọn người mượn");
  fillSelect(byId("leAccountId"), accounts, draft?.accountId || "", "Chọn tài khoản");

  const idEl = byId("leId");
  const amountEl = byId("leAmount");
  const interestRateEl = byId("leInterestRate");
  const interestRateWrapEl = byId("leInterestRateWrap");
  const occurredAtEl = byId("leOccurredAt");
  const noteEl = byId("leNote");
  if (idEl) idEl.value = draft?.id || "";
  if (amountEl) amountEl.value = draft?.amount ?? "";
  if (interestRateEl) interestRateEl.value = draft?.interestRate ?? 0;
  if (interestRateWrapEl) interestRateWrapEl.classList.toggle("d-none", isRepay);
  if (occurredAtEl) occurredAtEl.value = draft?.occurredAt || "";
  if (noteEl) noteEl.value = draft?.note || "";

  const contextEl = byId("loanEntryContext");
  if (contextEl) {
    contextEl.classList.toggle("d-none", !context?.visible);
    contextEl.innerHTML = context?.visible
      ? `
        <div class="loan-entry-context ${context?.isOverpay ? "is-danger" : ""}">
          <div class="loan-entry-context-head">
            <strong>${escapeHtml(context.partyName || "")}</strong>
            <span>${escapeHtml(context.note || "")}</span>
          </div>
          <div class="loan-entry-context-grid">
            <span>Còn nợ hiện tại</span>
            <strong>${escapeHtml(context.outstandingBeforeText || formatCurrency(0))}</strong>
            ${
              context?.type === "loan_lend"
                ? `
                  <span>Gốc cho mượn</span>
                  <strong>${escapeHtml(context.principalText || formatCurrency(0))}</strong>
                  <span>Lãi</span>
                  <strong>${escapeHtml(context.interestRateText || "0%")} • ${escapeHtml(
                    context.interestAmountText || formatCurrency(0)
                  )}</strong>
                  <span>Tổng phải thu</span>
                  <strong>${escapeHtml(context.receivableAmountText || formatCurrency(0))}</strong>
                `
                : `
                  <span>Số tiền nhận trả</span>
                  <strong>${escapeHtml(context.amountText || formatCurrency(0))}</strong>
                `
            }
            <span>Sau khi lưu</span>
            <strong>${escapeHtml(context.outstandingAfterText || formatCurrency(0))}</strong>
          </div>
        </div>
      `
      : "";
  }
}

export function renderLoansRoute(vm = {}) {
  renderSummary(byId("loansSummary"), vm?.summary || {});

  const countEl = byId("loanPartiesCount");
  if (countEl) countEl.textContent = vm?.parties?.countText || "0 người";

  const selectedTitleEl = byId("loanSelectedPartyTitle");
  if (selectedTitleEl) {
    selectedTitleEl.textContent = vm?.selectedParty?.name || "Lịch sử công nợ";
  }

  const selectedMetaEl = byId("loanSelectedPartyMeta");
  if (selectedMetaEl) {
    selectedMetaEl.textContent = vm?.selectedParty
      ? [
          `Còn nợ ${vm.selectedParty.outstandingText}`,
          `Đã mượn ${vm.selectedParty.lendTotalText}`,
          ...(Number(vm.selectedParty.interestTotal || 0) > 0 ? [`Lãi ${vm.selectedParty.interestTotalText}`] : []),
          `Đã trả ${vm.selectedParty.repayTotalText}`,
        ].join(" • ")
      : "Chọn một người mượn để xem lịch sử công nợ.";
  }

  const lendButtons = [byId("btnLoanSelectedLend")];
  const repayButtons = [byId("btnLoanSelectedRepay")];
  lendButtons.forEach((button) => {
    if (!button) return;
    button.disabled = !vm?.selectedPartyId;
    button.setAttribute("data-party-id", vm?.selectedPartyId || "");
  });
  repayButtons.forEach((button) => {
    if (!button) return;
    button.disabled = !vm?.selectedPartyId;
    button.setAttribute("data-party-id", vm?.selectedPartyId || "");
  });

  renderPartyList(byId("loanPartiesList"), vm?.parties || {}, vm?.selectedPartyId || "");
  renderTimeline(byId("loanTimeline"), vm);
}
