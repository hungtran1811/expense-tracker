// assets/accounts.js
// Xử lý phần TÀI KHOẢN: load + fill UI + số dư

import {
  listAccounts,
  balancesByAccountTotal,
  addAccount,
  updateAccount,
  deleteAccountWithReassign,
  addTransfer,
} from "./db.js";
import {
  fillAccountSelect,
  renderAccountsTable,
  renderBalancesList,
} from "./ui.js";
import { showToast } from "./core.js";
import { auth } from "./auth.js";

// Cache local trong module, dùng cho kiểm tra trùng tên, v.v.
let _accountsCache = [];

/**
 * 1. Load danh sách tài khoản và đổ vào các khu vực liên quan
 * - uid: user.uid hiện tại
 * - currentFilterAccount: giá trị filter tài khoản đang chọn ở trang Báo cáo ("all" hoặc tên account)
 * Trả về:
 * - { accounts, accountFilter } để main.js cập nhật lại _accounts và _reportFilters.account
 */
export async function loadAccountsAndFill(uid, currentFilterAccount = "all") {
  if (!uid) {
    return { accounts: [], accountFilter: currentFilterAccount };
  }

  // Lấy danh sách tài khoản từ DB
  const accounts = await listAccounts(uid);
  _accountsCache = Array.isArray(accounts) ? accounts : [];

  // ===== Modal chuyển tiền (tfFrom, tfTo) =====
  // ===== Modal chuyển tiền (tfFrom, tfTo) =====
  // IMPORTANT: transfer nên dùng accountId (không dùng name) để db.js xử lý chuẩn
  const fillTransferSelect = (sel, list) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn tài khoản --</option>';

    (list || []).forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc.id || acc.name; // ưu tiên id
      opt.textContent = acc.name || "(No name)";
      opt.dataset.name = acc.name || "";
      sel.appendChild(opt);
    });
  };

  fillTransferSelect(document.getElementById("tfFrom"), accounts);
  fillTransferSelect(document.getElementById("tfTo"), accounts);

  const tfFrom = document.getElementById("tfFrom");
  const tfTo = document.getElementById("tfTo");
  if (tfFrom && tfTo && tfFrom.value === tfTo.value) {
    const second = tfTo.options.length > 1 ? tfTo.options[1].value : tfTo.value;
    tfTo.value = second;
  }

  // ===== Bảng tài khoản (nếu trang có) =====
  const tbodyAcc = document.querySelector("#accountsTable tbody");
  if (tbodyAcc && typeof renderAccountsTable === "function") {
    renderAccountsTable(tbodyAcc, accounts);
  }

  // ===== Các select tài khoản khác =====
  const targets = ["inAccount", "mAccount", "eAccount", "iAccount"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  targets.forEach((sel) => fillAccountSelect?.(sel, accounts));

  // ===== Filter tài khoản trong trang Báo cáo (accountSelect) =====
  const reportAccSelect = document.getElementById("accountSelect");
  let newFilterAccount = currentFilterAccount;

  if (reportAccSelect) {
    reportAccSelect.innerHTML =
      '<option value="all">Tất cả tài khoản</option>' +
      accounts
        .map((acc) => `<option value="${acc.name}">${acc.name}</option>`)
        .join("");

    if (
      newFilterAccount !== "all" &&
      [...reportAccSelect.options].some((o) => o.value === newFilterAccount)
    ) {
      // Nếu filter hiện tại vẫn tồn tại trong list account => giữ nguyên
      reportAccSelect.value = newFilterAccount;
    } else {
      // Nếu account cũ không còn nữa => reset về "all"
      reportAccSelect.value = "all";
      newFilterAccount = "all";
    }
  }

  return { accounts, accountFilter: newFilterAccount };
}

export function initAccountEvents() {
  /* ===== 1. THÊM TÀI KHOẢN (#btnAddAccount) ===== */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("#btnAddAccount");
    if (!btn) return;

    const user = auth.currentUser;
    if (!user) {
      showToast("Vui lòng đăng nhập trước", "error");
      return;
    }

    const name = (document.getElementById("aName")?.value || "").trim();
    const type = document.getElementById("aType")?.value || "bank";
    const isDefault = !!document.getElementById("aDefault")?.checked;

    try {
      if (!name) throw new Error("Vui lòng nhập tên tài khoản");

      if (
        Array.isArray(_accountsCache) &&
        _accountsCache.some(
          (a) => (a.name || "").toLowerCase() === name.toLowerCase()
        )
      ) {
        throw new Error("Tên tài khoản đã tồn tại");
      }

      await addAccount(user.uid, { name, type, isDefault });

      // reset form
      document.getElementById("aName").value = "";
      document.getElementById("aType").value = "bank";
      document.getElementById("aDefault").checked = false;

      bootstrap.Modal.getInstance(
        document.getElementById("addAccountModal")
      )?.hide();

      const { accounts } = await loadAccountsAndFill(user.uid, "all");
      _accountsCache = accounts || [];
      await refreshBalances(user.uid);

      showToast("Đã thêm tài khoản mới!");
    } catch (err) {
      console.error(err);
      showToast("Không thể thêm tài khoản: " + (err.message || err), "error");
    }
  });

  /* ===== 2. CLICK TRONG BẢNG TÀI KHOẢN (SỬA / XOÁ) ===== */
  const tbody = document.querySelector("#accountsTable tbody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const tr = btn.closest("tr");
      if (!tr) return;

      // ưu tiên lấy id từ data-id; nếu không có thì fallback theo tên
      const rowId = tr.dataset.id;
      let account =
        (rowId && _accountsCache.find((a) => a.id === rowId)) || null;

      if (!account) {
        const nameCell = tr.querySelector("td");
        const name = nameCell?.textContent?.trim();
        if (name) {
          account = _accountsCache.find((a) => (a.name || "").trim() === name);
        }
      }

      if (!account) return;

      const label = btn.textContent.trim().toLowerCase();

      // ---- SỬA ----
      if (label.startsWith("sửa")) {
        const idInput = document.getElementById("eaId");
        const nameInput = document.getElementById("eaName");
        const typeSelect = document.getElementById("eaType");
        const defaultCheckbox = document.getElementById("eaDefault");
        if (!idInput || !nameInput || !typeSelect || !defaultCheckbox) return;

        idInput.value = account.id;
        nameInput.value = account.name || "";
        typeSelect.value = account.type || "bank";
        defaultCheckbox.checked = !!account.isDefault;

        new bootstrap.Modal(document.getElementById("editAccountModal")).show();
      }

      // ---- XOÁ ----
      if (label.startsWith("xoá") || label.startsWith("xóa")) {
        const idInput = document.getElementById("daId");
        const targetSelect = document.getElementById("daTarget");
        if (!idInput || !targetSelect) return;

        idInput.value = account.id;
        targetSelect.innerHTML = _accountsCache
          .filter((a) => a.id !== account.id)
          .map((a) => `<option value="${a.id}">${a.name}</option>`)
          .join("");

        new bootstrap.Modal(
          document.getElementById("deleteAccountModal")
        ).show();
      }
    });
  }

  /* ===== 3. LƯU TÀI KHOẢN SAU KHI SỬA (#btnSaveAccount) ===== */
  document
    .getElementById("btnSaveAccount")
    ?.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;

      const id = document.getElementById("eaId")?.value;
      const name = document.getElementById("eaName")?.value.trim();
      const type = document.getElementById("eaType")?.value || "bank";
      const isDefault = !!document.getElementById("eaDefault")?.checked;

      try {
        if (!id) throw new Error("Thiếu ID tài khoản");
        if (!name) throw new Error("Tên tài khoản không được để trống");

        if (
          _accountsCache.some(
            (a) =>
              a.id !== id && (a.name || "").toLowerCase() === name.toLowerCase()
          )
        ) {
          throw new Error("Tên tài khoản đã tồn tại!");
        }

        await updateAccount(user.uid, id, { name, type, isDefault });

        bootstrap.Modal.getInstance(
          document.getElementById("editAccountModal")
        )?.hide();

        const { accounts } = await loadAccountsAndFill(user.uid, "all");
        _accountsCache = accounts || [];
        await refreshBalances(user.uid);

        showToast("Đã cập nhật tài khoản!");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Lỗi khi cập nhật tài khoản", "danger");
      }
    });

  /* ===== 4. XOÁ TÀI KHOẢN (#btnConfirmDeleteAccount) ===== */
  document
    .getElementById("btnConfirmDeleteAccount")
    ?.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;

      const id = document.getElementById("daId")?.value;
      const targetId = document.getElementById("daTarget")?.value;

      try {
        if (!id) throw new Error("Thiếu ID tài khoản cần xoá");
        if (!targetId)
          throw new Error("Vui lòng chọn tài khoản để chuyển dữ liệu sang");

        await deleteAccountWithReassign(user.uid, id, targetId);

        bootstrap.Modal.getInstance(
          document.getElementById("deleteAccountModal")
        )?.hide();

        const { accounts } = await loadAccountsAndFill(user.uid, "all");
        _accountsCache = accounts || [];
        await refreshBalances(user.uid);

        showToast("Đã xoá tài khoản!");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Không thể xoá tài khoản", "danger");
      }
    });

  /* ===== 6. CHUYỂN TIỀN GIỮA CÁC TÀI KHOẢN (#btnDoTransfer) ===== */
  document
    .getElementById("btnDoTransfer")
    ?.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) {
        showToast("Vui lòng đăng nhập trước", "error");
        return;
      }

      // Lấy element
      const fromSel = document.getElementById("tfFrom");
      const toSel = document.getElementById("tfTo");
      const amountInput = document.getElementById("tfAmount");
      const dateInput = document.getElementById("tfDate");
      const noteInput = document.getElementById("tfNote");

      try {
        // Lấy value
        const fromId = (fromSel?.value || "").trim();
        const toId = (toSel?.value || "").trim();

        const amountRaw = (amountInput?.value || "").toString().trim();
        const amount = Number(amountRaw.replaceAll(",", "")); // phòng trường hợp bạn nhập 1,000,000

        const date = (dateInput?.value || "").trim();
        const note = (noteInput?.value || "").trim();

        // Lấy name từ option dataset (đã được set khi fillTransferSelect)
        const fromName =
          fromSel?.selectedOptions?.[0]?.dataset?.name ||
          _accountsCache.find((a) => a.id === fromId)?.name ||
          "";

        const toName =
          toSel?.selectedOptions?.[0]?.dataset?.name ||
          _accountsCache.find((a) => a.id === toId)?.name ||
          "";

        // ===== VALIDATE (cực rõ ràng) =====
        if (!fromId || !toId) throw new Error("Vui lòng chọn đầy đủ tài khoản");
        if (fromId === toId)
          throw new Error("Tài khoản chuyển đi và nhận không được trùng nhau");
        if (!amountRaw) throw new Error("Vui lòng nhập số tiền");
        if (!Number.isFinite(amount) || amount <= 0)
          throw new Error("Số tiền không hợp lệ");
        if (!date) throw new Error("Vui lòng chọn ngày");

        await addTransfer(user.uid, {
          // ✅ ID để DB update đúng account doc
          fromAccountId: fromId,
          toAccountId: toId,

          // ✅ vẫn giữ id alias nếu DB cần
          fromId,
          toId,

          // ✅ QUAN TRỌNG: from/to phải là TÊN để balancesByAccountTotal group đúng
          from: fromName || fromId,
          to: toName || toId,

          // ✅ name để hiển thị/log
          fromAccount: fromName || fromId,
          toAccount: toName || toId,
          fromName: fromName || "",
          toName: toName || "",

          amount,
          date,
          note,
        });

        // ===== RESET FORM =====
        if (amountInput) amountInput.value = "";
        if (dateInput) dateInput.value = "";
        if (noteInput) noteInput.value = "";

        // Đóng modal chuyển tiền
        bootstrap.Modal.getInstance(
          document.getElementById("transferModal")
        )?.hide();

        // Chỉ cần cập nhật lại SỐ DƯ (Chi/Thu không đổi)
        await refreshBalances(user.uid);

        showToast("Đã chuyển tiền giữa các tài khoản!");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Không thể chuyển tiền", "danger");
      }
    });
}

// ===== Refresh balances (FIX: map đúng key id/name để không hiện "tài khoản lạ") =====
export async function refreshBalances(uid) {
  if (!uid) return;

  // 1) Lấy danh sách accounts để map ID -> NAME
  const accounts = await listAccounts(uid);
  const idToName = new Map(accounts.map((a) => [a.id, a.name]));
  const nameSet = new Set(accounts.map((a) => (a.name || "").trim()));

  // 2) Lấy số dư tổng hợp
  const items = await balancesByAccountTotal(uid);

  // 3) Normalize key theo đúng ưu tiên:
  // - Nếu item có accountId/id/fromAccountId/toAccountId => đó là docId
  // - Nếu item có account (string) và trùng tên tài khoản => đó là name
  const normalized = (items || []).map((it) => {
    const accountId =
      it.accountId ||
      it.account_id ||
      it.id ||
      it.fromAccountId ||
      it.toAccountId ||
      null;

    const accountNameCandidate =
      typeof it.account === "string" ? it.account.trim() : "";

    // Case A: Có docId => map sang name
    if (accountId && idToName.has(accountId)) {
      const name = idToName.get(accountId);
      return { ...it, name, accountName: name };
    }

    // Case B: account là name hợp lệ => giữ nguyên (không biến thành ID)
    if (accountNameCandidate && nameSet.has(accountNameCandidate)) {
      return {
        ...it,
        name: accountNameCandidate,
        accountName: accountNameCandidate,
      };
    }

    // Case C: fallback cuối cùng (nếu DB trả về dạng lạ)
    const fallback = accountId || it.name || it.account || "(Unknown)";
    return { ...it, name: fallback, accountName: fallback };
  });

  // 4) Render
  const wrap = document.getElementById("balanceList");
  if (wrap && typeof renderBalancesList === "function") {
    renderBalancesList(wrap, normalized);
  }
}
