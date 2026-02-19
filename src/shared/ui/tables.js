import { toCategoryLabelVi } from "../constants/categoryMap.vi.js";
import { formatVND } from "./core.js";

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toDateLabel(value) {
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? "--/--" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function fillSelectMonths(selectEl, monthsBack = 12) {
  if (!selectEl) return;

  const now = new Date();
  const items = [];

  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    items.push({
      ym,
      label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
    });
  }

  selectEl.innerHTML = items.map((x) => `<option value="${x.ym}">${x.label}</option>`).join("");
}

function expenseIcon(category) {
  const map = {
    "Food & Drink": "bi-cup-hot",
    Coffee: "bi-cup-straw",
    Personal: "bi-person",
    Rent: "bi-house-door",
    Fitness: "bi-dribbble",
    Groceries: "bi-basket",
    Transport: "bi-car-front",
    Healthcare: "bi-heart-pulse",
    Lending: "bi-cash-stack",
    Other: "bi-three-dots",
  };

  return map[category] || "bi-receipt";
}

function accountTypeLabel(type) {
  const map = {
    bank: "Ngân hàng",
    ewallet: "Ví điện tử",
    other: "Khác",
  };
  return map[type] || map.other;
}

export function renderExpensesTable(tbody, list) {
  if (!tbody) return;

  const safeList = Array.isArray(list) ? list : [];
  if (safeList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-4">Không tìm thấy giao dịch chi tiêu phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = safeList
    .map((item) => {
      const dateLabel = toDateLabel(item?.date);

      const categoryRaw = item.category || "Other";
      const category = safeText(toCategoryLabelVi(categoryRaw), "Khác");
      const icon = expenseIcon(categoryRaw);
      const itemId = safeText(item?.id);
      const name = escapeHtml(safeText(item?.name, "(Chưa đặt tên)"));
      const note = escapeHtml(safeText(item?.note, "Không có ghi chú"));
      const account = escapeHtml(safeText(item?.account));
      const amount = Number(item?.amount || 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;

      return `
      <tr data-id="${escapeHtml(itemId)}">
        <td data-col="date" data-label="Ngày"><span class="tx-date">${dateLabel}</span></td>
        <td data-col="transaction" data-label="Giao dịch">
          <div class="tx-main">
            <span class="tx-icon"><i class="bi ${icon}"></i></span>
            <div class="tx-main-text">
              <div class="tx-title">${name}</div>
              <div class="tx-note">${note}</div>
            </div>
          </div>
        </td>
        <td data-col="category" data-label="Danh mục">
          <span class="badge rounded-pill bg-secondary-subtle text-dark tx-chip">${escapeHtml(category)}</span>
        </td>
        <td data-col="account" data-label="Tài khoản"><span class="tx-account">${account}</span></td>
        <td data-col="amount" data-label="Số tiền" class="text-end"><strong class="tx-amount tx-expense">-${formatVND(
          safeAmount
        )}</strong></td>
        <td data-col="actions" class="text-end" data-label="Thao tác">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-expense-edit" title="Sửa"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger btn-expense-del" title="Xóa"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

export function renderAccountsTable(tbody, list) {
  if (!tbody) return;

  const safeList = Array.isArray(list) ? list : [];
  if (!safeList.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Chưa có tài khoản nào.</td></tr>';
    return;
  }

  tbody.innerHTML = safeList
    .map(
      (account) => `
    <tr data-id="${escapeHtml(safeText(account?.id))}">
      <td>${escapeHtml(safeText(account?.name, "(Không tên)"))}</td>
      <td><span class="badge text-bg-light">${accountTypeLabel(account?.type)}</span></td>
      <td>${account.isDefault ? '<span class="badge text-bg-primary">Mặc định</span>' : ""}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary btn-account-edit">Sửa</button>
          <button class="btn btn-outline-danger btn-account-del">Xóa</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

export function fillAccountSelect(selectEl, accounts, fallback = "Tài khoản chính") {
  if (!selectEl) return;

  const safeAccounts = (Array.isArray(accounts) ? accounts : [])
    .map((account) => ({
      name: safeText(account?.name),
      isDefault: !!account?.isDefault,
    }))
    .filter((account) => account.name);

  selectEl.innerHTML = "";
  safeAccounts.forEach((account) => {
    const option = new Option(account.name, account.name, account.isDefault, account.isDefault);
    selectEl.appendChild(option);
  });

  if (!selectEl.value && safeAccounts.length) {
    const defaultName = safeAccounts.find((x) => x.isDefault)?.name || safeAccounts[0].name || fallback;
    selectEl.value = defaultName;
  }
}

export function renderBalancesList(container, items) {
  if (!container) return;

  const safeItems = Array.isArray(items) ? items : [];
  container.innerHTML = safeItems.length
    ? safeItems
        .map(
          (it) => {
            const balance = Number(it?.balance || 0);
            const safeBalance = Number.isFinite(balance) ? balance : 0;
            const signClass = safeBalance < 0 ? "text-danger" : "text-success";
            return `
        <div class="d-flex justify-content-between border-bottom py-2 tx-balance-row">
          <span>${escapeHtml(safeText(it?.accountName || it?.account || it?.name, "(Không rõ)"))}</span>
          <strong class="${signClass}">${formatVND(safeBalance)}</strong>
        </div>
      `;
          }
        )
        .join("")
    : '<div class="text-muted">Chưa có dữ liệu</div>';
}

export function renderIncomesTable(tbody, list) {
  if (!tbody) return;

  const safeList = Array.isArray(list) ? list : [];
  if (safeList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted py-4">Không tìm thấy giao dịch thu nhập phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = safeList
    .map((item) => {
      const dateLabel = toDateLabel(item?.date);
      const itemId = safeText(item?.id);
      const name = escapeHtml(safeText(item?.name, "(Chưa đặt tên)"));
      const note = escapeHtml(safeText(item?.note, "Không có ghi chú"));
      const account = escapeHtml(safeText(item?.account));
      const amount = Number(item?.amount || 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;

      return `
      <tr data-id="${escapeHtml(itemId)}">
        <td data-col="date" data-label="Ngày"><span class="tx-date">${dateLabel}</span></td>
        <td data-col="transaction" data-label="Giao dịch">
          <div class="tx-main">
            <span class="tx-icon tx-icon-income"><i class="bi bi-arrow-down-circle"></i></span>
            <div class="tx-main-text">
              <div class="tx-title">${name}</div>
              <div class="tx-note">${note}</div>
            </div>
          </div>
        </td>
        <td data-col="account" data-label="Tài khoản"><span class="tx-account">${account}</span></td>
        <td data-col="amount" data-label="Số tiền" class="text-end"><strong class="tx-amount tx-income">+${formatVND(
          safeAmount
        )}</strong></td>
        <td data-col="actions" class="text-end" data-label="Thao tác">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-income-edit" title="Sửa"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger btn-income-del" title="Xóa"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}
