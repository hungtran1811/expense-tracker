import {
  listAccounts,
  balancesByAccountTotal,
  addAccount,
  updateAccount,
  deleteAccountWithReassign,
  addTransfer,
} from "../../services/firebase/firestore.js";
import {
  fillAccountSelect,
  renderAccountsTable,
  renderBalancesList,
} from "../../shared/ui/tables.js";
import { showToast } from "../../shared/ui/core.js";
import { auth } from "../../services/firebase/auth.js";

let _accountsCache = [];
let _eventsBound = false;

function toSafeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeErrorMessage(err, fallback) {
  if (err && typeof err === "object" && "message" in err && err.message) {
    return String(err.message);
  }
  return fallback;
}

function toSafeAccountList(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const id = toSafeText(item?.id);
      const name = toSafeText(item?.name, "(Chưa đặt tên)");
      const key = id || name;
      if (!key) return null;

      return {
        ...item,
        id,
        name,
        type: toSafeText(item?.type, "other"),
        isDefault: !!item?.isDefault,
      };
    })
    .filter(Boolean);
}

function toggleOffcanvas(id, action = "show") {
  const panel = document.getElementById(id);
  if (!panel) return;
  const instance = bootstrap.Offcanvas.getOrCreateInstance(panel);
  if (action === "hide") {
    instance.hide();
    return;
  }
  instance.show();
}

function findAccountNameById(accountId) {
  if (!accountId) return "";
  const found = _accountsCache.find((item) => item?.id === accountId);
  return toSafeText(found?.name);
}

export async function loadAccountsAndFill(uid, currentFilterAccount = "all") {
  if (!uid) return { accounts: [], accountFilter: currentFilterAccount };

  const loadedAccounts = await listAccounts(uid);
  const accounts = toSafeAccountList(loadedAccounts);
  _accountsCache = accounts;

  const fillTransferSelect = (sel, list) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn tài khoản --</option>';

    (Array.isArray(list) ? list : []).forEach((acc) => {
      const optionValue = acc?.id || acc?.name;
      if (!optionValue) return;

      const opt = document.createElement("option");
      opt.value = optionValue;
      opt.textContent = acc.name || "(Chưa đặt tên)";
      opt.dataset.name = acc.name || "";
      sel.appendChild(opt);
    });
  };

  fillTransferSelect(document.getElementById("tfFrom"), accounts);
  fillTransferSelect(document.getElementById("tfTo"), accounts);

  const tbodyAcc = document.querySelector("#accountsTable tbody");
  if (tbodyAcc) renderAccountsTable(tbodyAcc, accounts);

  const targets = ["inAccount", "mAccount", "eAccount", "iAccount"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  targets.forEach((sel) => fillAccountSelect(sel, accounts));

  const reportAccSelect = document.getElementById("accountSelect");
  let newFilterAccount = currentFilterAccount;

  if (reportAccSelect) {
    reportAccSelect.innerHTML = "";
    reportAccSelect.appendChild(new Option("Tất cả tài khoản", "all"));
    accounts.forEach((account) => {
      const name = toSafeText(account?.name);
      if (!name) return;
      reportAccSelect.appendChild(new Option(name, name));
    });

    if (
      newFilterAccount !== "all" &&
      [...reportAccSelect.options].some((o) => o.value === newFilterAccount)
    ) {
      reportAccSelect.value = newFilterAccount;
    } else {
      reportAccSelect.value = "all";
      newFilterAccount = "all";
    }
  }

  return { accounts, accountFilter: newFilterAccount };
}

export function initAccountEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("#btnAddAccount");
    if (!btn) return;

    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    const name = (document.getElementById("aName")?.value || "").trim();
    const type = document.getElementById("aType")?.value || "bank";
    const isDefault = !!document.getElementById("aDefault")?.checked;

    try {
      if (!name) throw new Error("Vui lòng nhập tên tài khoản");
      if (_accountsCache.some((a) => (a.name || "").toLowerCase() === name.toLowerCase())) {
        throw new Error("Tên tài khoản đã tồn tại");
      }

      await addAccount(user.uid, { name, type, isDefault });

      const addName = document.getElementById("aName");
      const addType = document.getElementById("aType");
      const addDefault = document.getElementById("aDefault");
      if (addName) addName.value = "";
      if (addType) addType.value = "bank";
      if (addDefault) addDefault.checked = false;

      toggleOffcanvas("addAccountModal", "hide");

      const { accounts } = await loadAccountsAndFill(user.uid, "all");
      _accountsCache = accounts || [];
      await refreshBalances(user.uid);

      showToast("Đã thêm tài khoản mới", "success");
    } catch (err) {
      showToast(safeErrorMessage(err, "Không thể thêm tài khoản"), "error");
    }
  });

  const tbody = document.querySelector("#accountsTable tbody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const tr = btn.closest("tr");
      if (!tr) return;

      const rowId = tr.dataset.id;
      const account = _accountsCache.find((a) => a.id === rowId);
      if (!account) return;

      if (btn.classList.contains("btn-account-edit")) {
        const idInput = document.getElementById("eaId");
        const nameInput = document.getElementById("eaName");
        const typeSelect = document.getElementById("eaType");
        const defaultCheckbox = document.getElementById("eaDefault");
        if (!idInput || !nameInput || !typeSelect || !defaultCheckbox) return;

        idInput.value = account.id;
        nameInput.value = account.name || "";
        typeSelect.value = account.type || "bank";
        defaultCheckbox.checked = !!account.isDefault;
        toggleOffcanvas("editAccountModal", "show");
      }

      if (btn.classList.contains("btn-account-del")) {
        const idInput = document.getElementById("daId");
        const targetSelect = document.getElementById("daTarget");
        if (!idInput || !targetSelect) return;

        idInput.value = account.id;
        targetSelect.innerHTML = "";
        _accountsCache
          .filter((a) => a.id !== account.id)
          .forEach((a) => {
            const optionValue = toSafeText(a?.id);
            if (!optionValue) return;
            targetSelect.appendChild(new Option(toSafeText(a?.name, "(Chưa đặt tên)"), optionValue));
          });

        toggleOffcanvas("deleteAccountModal", "show");
      }
    });
  }

  document.getElementById("btnSaveAccount")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const id = document.getElementById("eaId")?.value;
    const name = (document.getElementById("eaName")?.value || "").trim();
    const type = document.getElementById("eaType")?.value || "bank";
    const isDefault = !!document.getElementById("eaDefault")?.checked;

    try {
      if (!id) throw new Error("Thiếu ID tài khoản");
      if (!name) throw new Error("Tên tài khoản không được để trống");

      if (_accountsCache.some((a) => a.id !== id && (a.name || "").toLowerCase() === name.toLowerCase())) {
        throw new Error("Tên tài khoản đã tồn tại");
      }

      await updateAccount(user.uid, id, { name, type, isDefault });
      toggleOffcanvas("editAccountModal", "hide");

      const { accounts } = await loadAccountsAndFill(user.uid, "all");
      _accountsCache = accounts || [];
      await refreshBalances(user.uid);

      showToast("Đã cập nhật tài khoản", "success");
    } catch (err) {
      showToast(safeErrorMessage(err, "Không thể cập nhật tài khoản"), "error");
    }
  });

  document.getElementById("btnConfirmDeleteAccount")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const id = document.getElementById("daId")?.value;
    const targetId = document.getElementById("daTarget")?.value;

    try {
      if (!id) throw new Error("Thiếu ID tài khoản cần xóa");
      if (!targetId) throw new Error("Vui lòng chọn tài khoản để chuyển dữ liệu");

      await deleteAccountWithReassign(user.uid, id, targetId);
      toggleOffcanvas("deleteAccountModal", "hide");

      const { accounts } = await loadAccountsAndFill(user.uid, "all");
      _accountsCache = accounts || [];
      await refreshBalances(user.uid);

      showToast("Đã xóa tài khoản", "success");
    } catch (err) {
      showToast(safeErrorMessage(err, "Không thể xóa tài khoản"), "error");
    }
  });

  document.getElementById("btnDoTransfer")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return showToast("Vui lòng đăng nhập trước", "error");

    const fromSel = document.getElementById("tfFrom");
    const toSel = document.getElementById("tfTo");
    const amountInput = document.getElementById("tfAmount");
    const dateInput = document.getElementById("tfDate");
    const noteInput = document.getElementById("tfNote");

    try {
      const fromId = (fromSel?.value || "").trim();
      const toId = (toSel?.value || "").trim();
      const amountRaw = (amountInput?.value || "").toString().trim();
      const amount = Number(amountRaw.replaceAll(",", ""));
      const date = (dateInput?.value || "").trim();
      const note = (noteInput?.value || "").trim();

      const fromName = toSafeText(
        fromSel?.selectedOptions?.[0]?.dataset?.name || findAccountNameById(fromId)
      );
      const toName = toSafeText(toSel?.selectedOptions?.[0]?.dataset?.name || findAccountNameById(toId));

      if (!fromId || !toId) throw new Error("Vui lòng chọn đầy đủ tài khoản");
      if (fromId === toId) throw new Error("Tài khoản chuyển và nhận phải khác nhau");
      if (!amountRaw) throw new Error("Vui lòng nhập số tiền");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ");
      if (!date) throw new Error("Vui lòng chọn ngày");

      await addTransfer(user.uid, {
        fromAccountId: fromId,
        toAccountId: toId,
        fromId,
        toId,
        from: fromName || fromId,
        to: toName || toId,
        fromAccount: fromName || fromId,
        toAccount: toName || toId,
        fromName: fromName || "",
        toName: toName || "",
        amount,
        date,
        note,
      });

      if (amountInput) amountInput.value = "";
      if (dateInput) dateInput.value = "";
      if (noteInput) noteInput.value = "";

      toggleOffcanvas("transferModal", "hide");
      await refreshBalances(user.uid);
      showToast("Đã chuyển tiền giữa các tài khoản", "success");
    } catch (err) {
      showToast(safeErrorMessage(err, "Không thể chuyển tiền"), "error");
    }
  });
}

export async function refreshBalances(uid) {
  if (!uid) return [];

  const loadedAccounts = await listAccounts(uid);
  const accounts = toSafeAccountList(loadedAccounts);
  _accountsCache = accounts;
  const idToName = new Map(accounts.map((a) => [a.id, a.name]));
  const nameSet = new Set(accounts.map((a) => (a.name || "").trim()));

  const loadedItems = await balancesByAccountTotal(uid);
  const items = Array.isArray(loadedItems) ? loadedItems : [];

  const normalized = items.map((it) => {
    const accountId = toSafeText(
      it?.accountId || it?.account_id || it?.id || it?.fromAccountId || it?.toAccountId
    );
    const accountNameCandidate = toSafeText(it?.account);
    const balance = Number(it?.balance || 0);
    const safeBalance = Number.isFinite(balance) ? balance : 0;

    if (accountId && idToName.has(accountId)) {
      const name = idToName.get(accountId);
      return { ...it, balance: safeBalance, name, accountName: name };
    }

    if (accountNameCandidate && nameSet.has(accountNameCandidate)) {
      return {
        ...it,
        balance: safeBalance,
        name: accountNameCandidate,
        accountName: accountNameCandidate,
      };
    }

    const fallback = toSafeText(accountId || it?.name || it?.account, "(Không rõ)");
    return { ...it, balance: safeBalance, name: fallback, accountName: fallback };
  });

  const withFallbackAccounts = normalized.length
    ? normalized
    : accounts.map((account) => ({
        accountId: account.id,
        accountName: account.name,
        name: account.name,
        balance: 0,
      }));

  const wrap = document.getElementById("balanceList");
  if (wrap) renderBalancesList(wrap, withFallbackAccounts);

  window.dispatchEvent(new CustomEvent("nexus:balances-updated", { detail: withFallbackAccounts }));
  return withFallbackAccounts;
}
