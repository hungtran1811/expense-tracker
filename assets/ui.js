export function fillSelectMonths(selectEl, monthsBack = 12) {
  if (!selectEl) return;
  const now = new Date();
  const items = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    items.push({ ym, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` });
  }
  selectEl.innerHTML = items
    .map((x) => `<option value="${x.ym}">${x.label}</option>`)
    .join("");
}

export function renderExpensesTable(tbody, list) {
  tbody.innerHTML = list
    .map((e) => {
      const d = e.date?.seconds
        ? new Date(e.date.seconds * 1000)
        : new Date(e.date);
      const dd = isNaN(d)
        ? "--/--"
        : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      return `
      <tr data-id="${e.id}">
        <td data-label="Ngày">${dd}</td>
        <td data-label="Tên">${e.name || ""}</td>
        <td data-label="Danh mục">
          <span class="badge rounded-pill bg-secondary-subtle text-dark">${
            e.category || ""
          }</span>
        </td>
        <td data-label="Tài khoản">${e.account || ""}</td>
        <td data-label="Số tiền">${Number(e.amount || 0).toLocaleString(
          "vi-VN"
        )}đ</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-expense-edit"><i class="bi bi-pencil"></i> Sửa</button>
            <button class="btn btn-outline-danger btn-expense-del"><i class="bi bi-trash"></i> Xoá</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// Đổ bảng tài khoản (trang Accounts)
export function renderAccountsTable(tbody, list) {
  if (!tbody) return;
  tbody.innerHTML = list
    .map(
      (a) => `
    <tr data-id="${a.id}">
      <td>${a.name}</td>
      <td><span class="badge text-bg-light">${a.type || "bank"}</span></td>
      <td>${
        a.isDefault ? '<span class="badge text-bg-primary">Mặc định</span>' : ""
      }</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <!-- Chỉ “Thêm” ở bước này; Sửa/Xoá mình sẽ làm ở bước sau -->
          <button class="btn btn-outline-secondary">Sửa</button>
          <button class="btn btn-outline-danger">Xoá</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

// Fill danh sách tài khoản vào các select (Thêm chi / Sửa chi / Modal / Thu nhập)
export function fillAccountSelect(selectEl, accounts, fallback = "MSB") {
  if (!selectEl) return;
  selectEl.innerHTML = accounts
    .map((a) => `<option ${a.isDefault ? "selected" : ""}>${a.name}</option>`)
    .join("");
  // Nếu chưa có selected, set mặc định là account default, hoặc phần tử đầu, hoặc fallback
  if (!selectEl.value && accounts.length) {
    const defName =
      accounts.find((a) => a.isDefault)?.name || accounts[0].name || fallback;
    selectEl.value = defName;
  }
}

// Hiển thị số dư theo tài khoản (list đơn giản)
export function renderBalancesList(container, items) {
  if (!container) return;
  container.innerHTML = items.length
    ? items
        .map(
          (it) => `
        <div class="d-flex justify-content-between border-bottom py-1">
          <span>${it.account}</span>
          <strong>${Number(it.balance || 0).toLocaleString("vi-VN")}đ</strong>
        </div>
      `
        )
        .join("")
    : '<div class="text-muted">Chưa có dữ liệu</div>';
}

// Hiển thị bảng thu nhập
export function renderIncomesTable(tbody, list) {
  if (!tbody) return;
  tbody.innerHTML = list
    .map((i) => {
      const d = i.date?.seconds
        ? new Date(i.date.seconds * 1000)
        : new Date(i.date);
      const dateStr = isNaN(d)
        ? "--/--"
        : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      return `
      <tr data-id="${i.id}">
        <td>${dateStr}</td>
        <td>${i.name || ""}</td>
        <td>${i.account || ""}</td>
        <td>${Number(i.amount || 0).toLocaleString("vi-VN")}đ</td>
        <td class="text-end">
          <button class="btn btn-outline-secondary btn-sm btn-income-edit">Sửa</button>
          <button class="btn btn-outline-danger btn-sm btn-income-del">Xoá</button>
        </td>
      </tr>
    `;
    })
    .join("");
}
