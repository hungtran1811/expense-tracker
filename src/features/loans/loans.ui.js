import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
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
  const totalOutstandingText = summary.totalOutstandingText || "0đ";
  const activeCount = Number(summary.activePartyCount || 0);
  const spotlightNote = formatTemplate(t("loans.spotlightNote", "{{count}} người đang nợ"), {
    count: activeCount,
  });

  container.innerHTML = `
    <article class="loans-spotlight-main">
      <span class="loans-spotlight-label">${escapeHtml(t("loans.summary.totalOutstanding", "Tổng còn nợ"))}</span>
      <strong class="loans-spotlight-value u-money" title="${escapeHtml(totalOutstandingText)}">${escapeHtml(totalOutstandingText)}</strong>
      <span class="loans-spotlight-note">${escapeHtml(spotlightNote)}</span>
    </article>
    <div class="loans-spotlight-side">
      <article class="loans-spotlight-stat tone-lent">
        <span>${escapeHtml(t("loans.summary.lentTotal", "Đã cho mượn"))}</span>
        <strong class="u-money" title="${escapeHtml(summary.lentTotalText || "0đ")}">${escapeHtml(summary.lentTotalText || "0đ")}</strong>
      </article>
      <article class="loans-spotlight-stat tone-repaid">
        <span>${escapeHtml(t("loans.summary.repaidTotal", "Đã nhận trả"))}</span>
        <strong class="u-money" title="${escapeHtml(summary.repaidTotalText || "0đ")}">${escapeHtml(summary.repaidTotalText || "0đ")}</strong>
      </article>
    </div>
  `;
}

function renderPartyList(container, block = {}, selectedPartyId = "") {
  if (!container) return;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    renderEmpty(
      container,
      block?.emptyTitle || t("loans.party.emptyTitle", "Chưa có người mượn nào"),
      block?.emptyBody || t("loans.party.emptyBody", "Thêm người mượn đầu tiên để bắt đầu theo dõi công nợ.")
    );
    return;
  }

  container.innerHTML = `
    <div class="loans-party-strip-track">
      ${items
        .map((item) => {
          const isActive = item.id === selectedPartyId;
          const initial = String(item.name || "?").trim().charAt(0).toUpperCase() || "?";
          const hasDebt = Number(item.outstanding || 0) > 0;
          return `
            <button
              type="button"
              class="loans-party-chip ${isActive ? "is-active" : ""}"
              data-loan-action="select-party"
              data-party-id="${escapeHtml(item.id)}"
              aria-pressed="${isActive ? "true" : "false"}"
            >
              <span class="loans-party-chip-initial" aria-hidden="true">${escapeHtml(initial)}</span>
              <span class="loans-party-chip-copy">
                <span class="loans-party-chip-name u-ellipsis">${escapeHtml(item.name)}</span>
                <span class="loans-party-chip-meta u-ellipsis">${escapeHtml(
                  hasDebt ? `Còn nợ ${item.outstandingText}` : t("loans.party.settled", "Đã trả hết")
                )}</span>
              </span>
            </button>
          `;
        })
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
      vm?.timeline?.emptyTitle || t("loans.historyEmpty", "Chưa có lịch sử công nợ"),
      vm?.timeline?.emptyBody ||
        (selectedParty
          ? t("loans.historyEmptyParty", "Người này chưa có giao dịch cho mượn hoặc trả lại.")
          : t("loans.historyEmptyBody", "Chọn hoặc thêm người để xem lịch sử."))
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
            <span class="ledger-day-count">${Number(group.items?.length || 0)} ${escapeHtml(t("loans.party.txSuffix", "giao dịch"))}</span>
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
                      <div class="ledger-item-note">${escapeHtml(row.note || t("loans.entry.noNote", "Không có ghi chú"))}</div>
                    </div>

                    <div class="ledger-entry-side">
                      <div class="ledger-entry-amount u-money ${escapeHtml(row.amountClass)}" title="${escapeHtml(row.amountText)}">${escapeHtml(row.amountText)}</div>
                      <div class="ledger-entry-actions">
                        <button class="btn btn-sm btn-outline-primary" data-loan-action="edit-entry" data-entry-id="${escapeHtml(row.id)}">
                          ${escapeHtml(t("common.edit", "Sửa"))}
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-loan-action="delete-entry" data-entry-id="${escapeHtml(row.id)}">
                          ${escapeHtml(t("common.delete", "Xóa"))}
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
  const isEdit = !!String(draft?.id || "").trim();
  const titleEl = byId("loanPartyTitle");
  const hintEl = byId("loanPartyPanel")?.querySelector(".modal-header .small.text-muted");

  if (titleEl) {
    titleEl.textContent = isEdit
      ? t("loans.partyForm.editTitle", "Sửa người mượn")
      : t("loans.partyForm.createTitle", "Thêm người mượn");
  }
  if (hintEl) {
    hintEl.textContent = t("loans.partyForm.hint", "Dùng tên người hoặc nhóm bạn cần theo dõi công nợ riêng.");
  }

  const idEl = byId("lpId");
  const nameEl = byId("lpName");
  const noteEl = byId("lpNote");
  if (idEl) idEl.value = draft?.id || "";
  if (nameEl) nameEl.value = draft?.name || "";
  if (noteEl) noteEl.value = draft?.note || "";
}

export function renderLoanEntryForm({ draft = {}, parties = [], accounts = [], context = {} } = {}) {
  const isRepay = String(draft?.type || "").trim() === "loan_repay";
  const isEdit = !!String(draft?.id || "").trim();

  const titleEl = byId("loanEntryTitle");
  const hintEl = byId("loanEntryHint");
  if (titleEl) {
    titleEl.textContent = isEdit
      ? isRepay
        ? t("loans.entry.editRepay", "Sửa nhận trả")
        : t("loans.entry.editLend", "Sửa cho mượn")
      : isRepay
        ? t("loans.entry.createRepay", "Nhận trả")
        : t("loans.entry.createLend", "Cho mượn");
  }
  if (hintEl) {
    hintEl.textContent = isRepay
      ? t("loans.entry.repayHint", "Khoản này sẽ tăng lại số dư tài khoản nhận tiền.")
      : t("loans.entry.lendHint", "Khoản này sẽ trừ trực tiếp khỏi số dư tài khoản bạn chọn.");
  }

  fillSelect(byId("leType"), LOAN_TRANSACTION_TYPE_OPTIONS, draft?.type || "loan_lend");
  fillSelect(
    byId("leLoanPartyId"),
    parties,
    draft?.loanPartyId || "",
    t("loans.entry.pickParty", "Chọn người mượn")
  );
  fillSelect(
    byId("leAccountId"),
    accounts,
    draft?.accountId || "",
    t("loans.entry.pickAccount", "Chọn tài khoản")
  );

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

  const shortcutsEl = byId("loanEntryShortcuts");
  if (shortcutsEl) {
    shortcutsEl.classList.remove("d-none");
    shortcutsEl.textContent = isRepay
      ? t("loans.entry.shortcutsRepay", "Từ tab Cho mượn: dùng chip Nhận trả để ghi nhanh khoản nhận trả.")
      : t("loans.entry.shortcutsLend", "Từ tab Cho mượn: dùng chip Cho mượn để ghi nhanh khoản cho mượn.");
  }

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
            <strong class="u-money" title="${escapeHtml(context.outstandingBeforeText || formatCurrency(0))}">${escapeHtml(context.outstandingBeforeText || formatCurrency(0))}</strong>
            ${
              context?.type === "loan_lend"
                ? `
                  <span>Gốc cho mượn</span>
                  <strong class="u-money" title="${escapeHtml(context.principalText || formatCurrency(0))}">${escapeHtml(context.principalText || formatCurrency(0))}</strong>
                  <span>Lãi</span>
                  <strong>${escapeHtml(context.interestRateText || "0%")} • <span class="u-money" title="${escapeHtml(context.interestAmountText || formatCurrency(0))}">${escapeHtml(
                    context.interestAmountText || formatCurrency(0)
                  )}</span></strong>
                  <span>Tổng phải thu</span>
                  <strong class="u-money" title="${escapeHtml(context.receivableAmountText || formatCurrency(0))}">${escapeHtml(context.receivableAmountText || formatCurrency(0))}</strong>
                `
                : `
                  <span>Số tiền nhận trả</span>
                  <strong class="u-money" title="${escapeHtml(context.amountText || formatCurrency(0))}">${escapeHtml(context.amountText || formatCurrency(0))}</strong>
                `
            }
            <span>Sau khi lưu</span>
            <strong class="u-money" title="${escapeHtml(context.outstandingAfterText || formatCurrency(0))}">${escapeHtml(context.outstandingAfterText || formatCurrency(0))}</strong>
          </div>
        </div>
      `
      : "";
  }
}

function renderDetailActions(vm = {}) {
  const actionsEl = byId("loanDetailActions");
  if (!actionsEl) return;

  const lendButton = byId("btnLoanSelectedLend");
  const repayButton = byId("btnLoanSelectedRepay");
  const party = vm?.selectedParty || null;
  const partyId = vm?.selectedPartyId || "";

  if (lendButton) {
    lendButton.disabled = !partyId;
    lendButton.setAttribute("data-party-id", partyId);
    lendButton.textContent = t("loans.chipLend", "Cho mượn");
  }
  if (repayButton) {
    repayButton.disabled = !partyId;
    repayButton.setAttribute("data-party-id", partyId);
    repayButton.textContent = t("loans.chipRepay", "Nhận trả");
  }

  const manageButtons = actionsEl.querySelectorAll("[data-loan-manage-action]");
  manageButtons.forEach((button) => button.remove());

  if (!party) return;

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "btn btn-sm btn-outline-secondary";
  editButton.setAttribute("data-loan-action", "edit-party");
  editButton.setAttribute("data-loan-manage-action", "true");
  editButton.setAttribute("data-party-id", party.id);
  editButton.textContent = t("loans.party.edit", "Sửa");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-sm btn-outline-danger";
  deleteButton.setAttribute("data-loan-action", "delete-party");
  deleteButton.setAttribute("data-loan-manage-action", "true");
  deleteButton.setAttribute("data-party-id", party.id);
  deleteButton.textContent = t("loans.party.delete", "Xóa");
  if (!party.canDelete) deleteButton.disabled = true;

  actionsEl.append(editButton, deleteButton);
}

export function renderLoansRoute(vm = {}) {
  const pageTitleEl = byId("loansPageTitle");
  if (pageTitleEl) pageTitleEl.textContent = t("loans.pageTitle", "Cho mượn");

  const workspaceInfoEl = byId("loansWorkspaceInfo");
  if (workspaceInfoEl) {
    workspaceInfoEl.textContent = t("loans.workspaceInfo", "Tiền cho bạn bè mượn — tách khỏi chi tiêu hằng ngày.");
  }

  const partiesTitleEl = byId("loanPartiesTitle");
  if (partiesTitleEl) partiesTitleEl.textContent = t("loans.partiesTitle", "Người mượn");

  const partiesSubtitleEl = byId("loanPartiesSubtitle");
  if (partiesSubtitleEl) {
    partiesSubtitleEl.textContent = t("loans.partiesStripHint", "Chọn người để xem và ghi công nợ.");
  }

  renderSummary(byId("loansSummary"), vm?.summary || {});

  const countEl = byId("loanPartiesCount");
  if (countEl) countEl.textContent = vm?.parties?.countText || `0 ${t("loans.party.countSuffix", "người")}`;

  const heroEl = byId("loanDetailHero");
  if (heroEl) heroEl.classList.toggle("has-party", !!vm?.selectedParty);

  const selectedTitleEl = byId("loanSelectedPartyTitle");
  if (selectedTitleEl) {
    selectedTitleEl.textContent = vm?.selectedParty?.name || t("loans.historyTitle", "Lịch sử công nợ");
  }

  const selectedMetaEl = byId("loanSelectedPartyMeta");
  if (selectedMetaEl) {
    const metaText = vm?.selectedParty
      ? [
          `Còn nợ ${vm.selectedParty.outstandingText}`,
          `Đã mượn ${vm.selectedParty.lendTotalText}`,
          ...(Number(vm.selectedParty.interestTotal || 0) > 0 ? [`Lãi ${vm.selectedParty.interestTotalText}`] : []),
          `Đã trả ${vm.selectedParty.repayTotalText}`,
        ].join(" • ")
      : t("loans.selectedPartyMetaEmpty", "Chọn một người mượn để xem lịch sử công nợ.");

    selectedMetaEl.textContent = metaText;
    if (vm?.selectedParty) {
      selectedMetaEl.classList.add("u-ellipsis");
      selectedMetaEl.title = metaText;
    } else {
      selectedMetaEl.classList.remove("u-ellipsis");
      selectedMetaEl.removeAttribute("title");
    }
  }

  renderDetailActions(vm);
  renderPartyList(byId("loanPartiesList"), vm?.parties || {}, vm?.selectedPartyId || "");
  renderTimeline(byId("loanTimeline"), vm);
}
