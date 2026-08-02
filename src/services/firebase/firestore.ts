// @ts-nocheck — legacy ledger helpers; prefer typed wrappers in ledgerApi.ts for new call sites.
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  limit,
  writeBatch,
  runTransaction,
  deleteField,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { app } from "./app";
import {
  normalizeAccountMoneyOwner,
  normalizeMoneyOwner,
  requireMoneyOwner,
} from "../../shared/lib/moneyOwner";
import { FINANCE_CATEGORIES } from "../../shared/constants/finance";

function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

const db = createDb();

/** Legacy collections kept only for resetFinanceData cleanup. */
export const colExpenses = (uid) => collection(db, `users/${uid}/expenses`);
export const colAccounts = (uid) => collection(db, `users/${uid}/accounts`);
export const colIncomes = (uid) => collection(db, `users/${uid}/incomes`);
export const colTransfers = (uid) => collection(db, `users/${uid}/transfers`);
export const colTransactions = (uid) => collection(db, `users/${uid}/transactions`);
export const colExpenseScopes = (uid) => collection(db, `users/${uid}/expenseScopes`);
export const colExpenseCategories = (uid) => collection(db, `users/${uid}/expenseCategories`);
export const colScopeBudgets = (uid) => collection(db, `users/${uid}/scopeBudgets`);
export const colLoanParties = (uid) => collection(db, `users/${uid}/loanParties`);
export const colRecurringRules = (uid) => collection(db, `users/${uid}/recurringRules`);
export const colSavingsGoals = (uid) => collection(db, `users/${uid}/savingsGoals`);
export const docUser = (uid) => doc(db, `users/${uid}`);

export async function getUserMoneyOwnerLabels(uid) {
  if (!uid) return null;
  const snap = await getDoc(docUser(uid));
  if (!snap.exists()) return null;
  return snap.data()?.moneyOwnerLabels || null;
}

export async function saveUserMoneyOwnerLabels(uid, labels = {}) {
  if (!uid) throw new Error("Thiếu tài khoản.");
  await setDoc(
    docUser(uid),
    {
      moneyOwnerLabels: {
        personal: String(labels.personal || "").trim(),
        mother: String(labels.mother || "").trim(),
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
  return true;
}

function ymToRange(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 1);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Timestamp.fromDate(value);
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return Timestamp.fromDate(d);
  }
  return null;
}

function toTimestampStrict(value, label = "date") {
  const ts = toTimestamp(value);
  if (!ts) throw new Error(`${label} không hợp lệ`);
  return ts;
}

function mapDocs(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function parseLocalDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const LEDGER_SCHEMA_VERSION = 2;
const LEDGER_TRANSACTION_TYPES = new Set([
  "expense",
  "income",
  "transfer",
  "adjustment",
  "loan_lend",
  "loan_repay",
]);
const LEDGER_ACCOUNT_TYPES = new Set(["bank", "wallet", "cash", "savings", "other"]);

function normalizeLedgerAccountType(value = "") {
  const text = String(value || "").trim();
  return LEDGER_ACCOUNT_TYPES.has(text) ? text : "other";
}

function normalizeLedgerTransactionType(value = "") {
  const text = String(value || "").trim();
  return LEDGER_TRANSACTION_TYPES.has(text) ? text : "expense";
}

function normalizeExpenseScopeName(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

const DEFAULT_EXPENSE_CATEGORY_SEEDS = Object.freeze(
  FINANCE_CATEGORIES.map((item) => ({ key: item.key, label: item.label }))
);

function slugifyCategoryKey(value = "") {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "category";
}

function normalizeMonthKey(value = "") {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new Error("Tháng ngân sách không hợp lệ.");
  }
  return raw;
}

function docAccount(uid, accountId) {
  return doc(db, `users/${uid}/accounts/${accountId}`);
}

function docTransaction(uid, transactionId) {
  return doc(db, `users/${uid}/transactions/${transactionId}`);
}

function docScopeBudget(uid, budgetId) {
  return doc(db, `users/${uid}/scopeBudgets/${budgetId}`);
}

function sortLedgerAccounts(items = []) {
  return [...items].sort((a, b) => {
    const archivedA = String(a?.status || "active") === "archived" ? 1 : 0;
    const archivedB = String(b?.status || "active") === "archived" ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    const defaultA = a?.isDefault ? -1 : 0;
    const defaultB = b?.isDefault ? -1 : 0;
    if (defaultA !== defaultB) return defaultA - defaultB;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function addLedgerEffect(map, accountId, delta) {
  const id = String(accountId || "").trim();
  const amount = Number(delta || 0);
  if (!id || !Number.isFinite(amount) || amount === 0) return;
  map.set(id, (map.get(id) || 0) + amount);
}

function buildLedgerEffects(transactionData = {}) {
  const effects = new Map();
  const type = normalizeLedgerTransactionType(transactionData?.type);
  const amount = Number(transactionData?.amount || 0);
  const accountId = String(transactionData?.accountId || "").trim();
  const toAccountId = String(transactionData?.toAccountId || "").trim();

  if (!Number.isFinite(amount)) return effects;
  if (type === "expense") {
    addLedgerEffect(effects, accountId, -Math.abs(amount));
    return effects;
  }
  if (type === "loan_lend") {
    addLedgerEffect(effects, accountId, -Math.abs(amount));
    return effects;
  }
  if (type === "income") {
    addLedgerEffect(effects, accountId, Math.abs(amount));
    return effects;
  }
  if (type === "loan_repay") {
    addLedgerEffect(effects, accountId, Math.abs(amount));
    return effects;
  }
  if (type === "transfer") {
    addLedgerEffect(effects, accountId, -Math.abs(amount));
    addLedgerEffect(effects, toAccountId, Math.abs(amount));
    return effects;
  }
  addLedgerEffect(effects, accountId, amount);
  return effects;
}

function buildLedgerTransactionDocData(normalized = {}, options = {}) {
  const createdAt = options?.createdAt || null;
  const updatedAt = options?.updatedAt || Timestamp.now();
  const forUpdate = !!options?.forUpdate;
  const type = normalizeLedgerTransactionType(normalized?.type);

  const data = {
    type,
    amount: Number(normalized?.amount || 0),
    occurredAt: normalized?.occurredAt || null,
    accountId: String(normalized?.accountId || "").trim(),
    moneyOwner: normalizeMoneyOwner(normalized?.moneyOwner),
    note: String(normalized?.note || "").trim(),
    schemaVersion: LEDGER_SCHEMA_VERSION,
    updatedAt,
  };

  if (createdAt) {
    data.createdAt = createdAt;
  }

  if (type === "transfer") {
    data.toAccountId = String(normalized?.toAccountId || "").trim();
  } else if (forUpdate) {
    data.toAccountId = deleteField();
  }

  if (type === "expense") {
    data.categoryKey = String(normalized?.categoryKey || "").trim() || "other";
    data.scopeId = String(normalized?.scopeId || "").trim();
  } else if (forUpdate) {
    data.categoryKey = deleteField();
    data.scopeId = deleteField();
  }

  if (type === "loan_lend" || type === "loan_repay") {
    data.loanPartyId = String(normalized?.loanPartyId || "").trim();
  } else if (forUpdate) {
    data.loanPartyId = deleteField();
  }

  if (type === "loan_lend") {
    data.interestRate = Math.max(0, Number(normalized?.interestRate || 0));
  } else if (forUpdate) {
    data.interestRate = deleteField();
  }

  return data;
}

function diffLedgerEffects(previousEffects, nextEffects) {
  const diff = new Map();
  previousEffects.forEach((value, accountId) => {
    addLedgerEffect(diff, accountId, -value);
  });
  nextEffects.forEach((value, accountId) => {
    addLedgerEffect(diff, accountId, value);
  });
  return diff;
}

function normalizeLedgerTransactionInput(payload = {}) {
  const type = normalizeLedgerTransactionType(payload?.type);
  const accountId = String(payload?.accountId || "").trim();
  const toAccountId = String(payload?.toAccountId || "").trim();
  const scopeId = String(payload?.scopeId || "").trim();
  const loanPartyId = String(payload?.loanPartyId || "").trim();
  const interestRate = Number(payload?.interestRate || 0);
  const note = String(payload?.note || "").trim();
  const occurredDate = parseLocalDate(payload?.occurredAt);
  if (!accountId) throw new Error("Vui lòng chọn tài khoản.");
  if (!occurredDate) throw new Error("Ngày ghi nhận không hợp lệ.");

  const rawAmount = Number(payload?.amount || 0);
  if (!Number.isFinite(rawAmount)) throw new Error("Số tiền không hợp lệ.");

  if (type === "transfer") {
    if (!toAccountId) throw new Error("Vui lòng chọn tài khoản nhận.");
    if (toAccountId === accountId) throw new Error("Tài khoản chuyển và nhận phải khác nhau.");
    if (!(rawAmount > 0)) throw new Error("Số tiền chuyển phải lớn hơn 0.");
  } else if (type === "loan_lend" || type === "loan_repay") {
    if (!loanPartyId) throw new Error("Vui lòng chọn người mượn.");
    if (!(rawAmount > 0)) throw new Error("Số tiền phải lớn hơn 0.");
    if (!Number.isFinite(interestRate) || interestRate < 0) {
      throw new Error("Lãi suất phải từ 0% trở lên.");
    }
  } else if (type === "adjustment") {
    if (rawAmount === 0) throw new Error("Bút toán điều chỉnh cần số tiền khác 0.");
  } else if (!(rawAmount > 0)) {
    throw new Error("Số tiền phải lớn hơn 0.");
  }

  if (type === "expense" && !scopeId) {
    throw new Error("Vui lòng chọn nhóm chi.");
  }

  const moneyOwner =
    type === "transfer" || type === "adjustment"
      ? normalizeMoneyOwner(payload?.moneyOwner || "unassigned")
      : requireMoneyOwner(payload?.moneyOwner || "personal");

  return {
    type,
    amount: type === "adjustment" ? rawAmount : Math.abs(rawAmount),
    occurredAt: Timestamp.fromDate(occurredDate),
    accountId,
    toAccountId: type === "transfer" ? toAccountId : "",
    categoryKey: type === "expense" ? String(payload?.categoryKey || "other").trim() || "other" : "",
    scopeId: type === "expense" ? scopeId : "",
    loanPartyId: type === "loan_lend" || type === "loan_repay" ? loanPartyId : "",
    interestRate: type === "loan_lend" ? Math.max(0, interestRate) : 0,
    moneyOwner,
    note,
    schemaVersion: LEDGER_SCHEMA_VERSION,
  };
}

function dateInputRangeToTimestamps(fromDate = "", toDate = "") {
  const startDate = parseLocalDate(fromDate);
  const endDate = parseLocalDate(toDate);
  if (!startDate && !endDate) return null;

  const range = {};
  if (startDate) {
    range.start = Timestamp.fromDate(startDate);
  }

  if (endDate) {
    const exclusiveEnd = new Date(endDate);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    range.end = Timestamp.fromDate(exclusiveEnd);
  }

  return range;
}

async function clearDefaultFlagForOtherAccounts(uid, keepId = "") {
  const snap = await getDocs(colAccounts(uid));
  const batch = writeBatch(db);
  let hasChanges = false;

  snap.docs.forEach((item) => {
    if (item.id === keepId) return;
    const data = item.data() || {};
    if (Number(data?.schemaVersion || 0) !== LEDGER_SCHEMA_VERSION) return;
    if (!data?.isDefault) return;
    batch.update(item.ref, {
      isDefault: false,
      updatedAt: Timestamp.now(),
    });
    hasChanges = true;
  });

  if (hasChanges) {
    await batch.commit();
  }
}

async function ensureActiveDefaultAccount(uid) {
  const snap = await getDocs(colAccounts(uid));
  const accounts = snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter(
      (item) =>
        Number(item?.schemaVersion || 0) === LEDGER_SCHEMA_VERSION &&
        String(item?.status || "active") !== "archived"
    );

  if (!accounts.length) return;
  if (accounts.some((item) => item?.isDefault)) return;

  const target = sortLedgerAccounts(accounts)[0];
  if (!target?.id) return;
  await updateDoc(docAccount(uid, target.id), {
    isDefault: true,
    updatedAt: Timestamp.now(),
  });
}

async function hasAnyTransactionForAccount(uid, accountId = "") {
  const id = String(accountId || "").trim();
  if (!id) return false;

  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(colTransactions(uid), where("accountId", "==", id), limit(1))),
    getDocs(query(colTransactions(uid), where("toAccountId", "==", id), limit(1))),
  ]);

  return !fromSnap.empty || !toSnap.empty;
}

export async function listAccountsWithBalances(uid) {
  const snap = await getDocs(colAccounts(uid));
  return sortLedgerAccounts(
    snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => Number(item?.schemaVersion || 0) === LEDGER_SCHEMA_VERSION)
      .map((item) => ({
        id: item.id,
        name: String(item?.name || "").trim(),
        type: normalizeLedgerAccountType(item?.type),
        openingBalance: Number(item?.openingBalance || 0),
        currentBalance: Number(item?.currentBalance || 0),
        isDefault: !!item?.isDefault,
        status: String(item?.status || "active") === "archived" ? "archived" : "active",
        moneyOwner: normalizeAccountMoneyOwner(item?.moneyOwner),
        createdAt: item?.createdAt || null,
        updatedAt: item?.updatedAt || null,
      }))
  );
}

function mapExpenseScopeDoc(item) {
  return {
    id: item.id,
    name: normalizeExpenseScopeName(item?.name),
    nameLower: String(item?.nameLower || normalizeExpenseScopeName(item?.name).toLowerCase()).trim(),
    sortOrder: Number(item?.sortOrder || 0),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

function sortExpenseScopes(items = []) {
  return [...items].sort((a, b) => {
    const orderDiff = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function mapLoanPartyDoc(item) {
  return {
    id: item.id,
    name: normalizeExpenseScopeName(item?.name),
    nameLower: String(item?.nameLower || normalizeExpenseScopeName(item?.name).toLowerCase()).trim(),
    note: String(item?.note || "").trim(),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

function sortLoanParties(items = []) {
  return [...items].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi"));
}

function mapScopeBudgetDoc(item) {
  return {
    id: item.id,
    scopeId: String(item?.scopeId || "").trim(),
    monthKey: String(item?.monthKey || "").trim(),
    limitAmount: Number(item?.limitAmount || 0),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

function sortScopeBudgets(items = []) {
  return [...items].sort((a, b) => {
    const monthDiff = String(a?.monthKey || "").localeCompare(String(b?.monthKey || ""));
    if (monthDiff !== 0) return monthDiff;
    return String(a?.scopeId || "").localeCompare(String(b?.scopeId || ""));
  });
}

export async function listExpenseScopes(uid) {
  const snap = await getDocs(colExpenseScopes(uid));
  return sortExpenseScopes(snap.docs.map((item) => mapExpenseScopeDoc({ id: item.id, ...item.data() })));
}

function mapExpenseCategoryDoc(item) {
  const name = normalizeExpenseScopeName(item?.name);
  const key = String(item?.key || item?.legacyKey || item?.id || "").trim();
  return {
    id: item.id,
    key: key || item.id,
    legacyKey: String(item?.legacyKey || item?.key || "").trim(),
    name,
    nameLower: String(item?.nameLower || name.toLowerCase()).trim(),
    parentId: String(item?.parentId || "").trim(),
    sortOrder: Number(item?.sortOrder || 0),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

function sortExpenseCategories(items = []) {
  return [...items].sort((a, b) => {
    const sortDiff = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
    if (sortDiff !== 0) return sortDiff;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

async function ensureDefaultExpenseCategories(uid) {
  const snap = await getDocs(colExpenseCategories(uid));
  if (!snap.empty) {
    return sortExpenseCategories(snap.docs.map((item) => mapExpenseCategoryDoc({ id: item.id, ...item.data() })));
  }

  const batch = writeBatch(db);
  const now = Timestamp.now();
  DEFAULT_EXPENSE_CATEGORY_SEEDS.forEach((seed, index) => {
    const ref = doc(colExpenseCategories(uid));
    batch.set(ref, {
      key: seed.key,
      legacyKey: seed.key,
      name: seed.label,
      nameLower: seed.label.toLowerCase(),
      parentId: "",
      sortOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    });
  });
  await batch.commit();

  const seeded = await getDocs(colExpenseCategories(uid));
  return sortExpenseCategories(seeded.docs.map((item) => mapExpenseCategoryDoc({ id: item.id, ...item.data() })));
}

export async function listExpenseCategories(uid) {
  return ensureDefaultExpenseCategories(uid);
}

export async function createExpenseCategory(uid, payload = {}) {
  const name = normalizeExpenseScopeName(payload?.name);
  if (!name) throw new Error("Vui lòng nhập tên danh mục.");

  const parentId = String(payload?.parentId || "").trim();
  const currentItems = await listExpenseCategories(uid);
  const nextNameLower = name.toLowerCase();
  if (
    currentItems.some(
      (item) => item.nameLower === nextNameLower && String(item.parentId || "") === parentId
    )
  ) {
    throw new Error("Danh mục này đã tồn tại.");
  }

  if (parentId && !currentItems.some((item) => item.id === parentId)) {
    throw new Error("Danh mục cha không hợp lệ.");
  }

  const maxSortOrder = currentItems
    .filter((item) => String(item.parentId || "") === parentId)
    .reduce((acc, item) => Math.max(acc, Number(item?.sortOrder || 0)), 0);

  let key = slugifyCategoryKey(name);
  const usedKeys = new Set(currentItems.map((item) => String(item.key || "").trim()));
  if (usedKeys.has(key)) {
    key = `${key}-${Date.now().toString(36).slice(-4)}`;
  }

  const ref = await addDoc(colExpenseCategories(uid), {
    key,
    legacyKey: "",
    name,
    nameLower: nextNameLower,
    parentId,
    sortOrder: maxSortOrder + 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return { id: ref.id, key };
}

export async function updateExpenseCategory(uid, categoryId, payload = {}) {
  const id = String(categoryId || "").trim();
  if (!id) throw new Error("Thiếu danh mục cần cập nhật.");

  const name = normalizeExpenseScopeName(payload?.name);
  if (!name) throw new Error("Vui lòng nhập tên danh mục.");

  const currentItems = await listExpenseCategories(uid);
  const current = currentItems.find((item) => item.id === id);
  if (!current) throw new Error("Không tìm thấy danh mục cần cập nhật.");

  const parentId =
    payload?.parentId === undefined ? String(current.parentId || "") : String(payload?.parentId || "").trim();
  const nextNameLower = name.toLowerCase();
  if (
    currentItems.some(
      (item) =>
        item.id !== id &&
        item.nameLower === nextNameLower &&
        String(item.parentId || "") === parentId
    )
  ) {
    throw new Error("Danh mục này đã tồn tại.");
  }

  if (parentId) {
    if (parentId === id) throw new Error("Danh mục cha không hợp lệ.");
    if (!currentItems.some((item) => item.id === parentId)) {
      throw new Error("Danh mục cha không hợp lệ.");
    }
  }

  await updateDoc(doc(db, `users/${uid}/expenseCategories/${id}`), {
    name,
    nameLower: nextNameLower,
    parentId,
    updatedAt: Timestamp.now(),
  });
  return true;
}

async function hasAnyTransactionForCategory(uid, categoryKey = "") {
  const key = String(categoryKey || "").trim();
  if (!key) return false;
  const snap = await getDocs(query(colTransactions(uid), where("categoryKey", "==", key), limit(1)));
  return !snap.empty;
}

async function reassignTransactionsToExpenseCategory(uid, fromKey = "", toKey = "") {
  const from = String(fromKey || "").trim();
  const to = String(toKey || "").trim();
  if (!from || !to || from === to) return 0;

  const snap = await getDocs(query(colTransactions(uid), where("categoryKey", "==", from)));
  if (snap.empty) return 0;

  const docs = snap.docs.filter(
    (item) => normalizeLedgerTransactionType(item.data()?.type) === "expense"
  );
  if (!docs.length) return 0;

  let updatedCount = 0;
  while (docs.length) {
    const chunk = docs.splice(0, 400);
    const batch = writeBatch(db);
    const now = Timestamp.now();
    chunk.forEach((item) => {
      batch.update(item.ref, {
        categoryKey: to,
        updatedAt: now,
      });
    });
    await batch.commit();
    updatedCount += chunk.length;
  }
  return updatedCount;
}

export async function deleteExpenseCategory(uid, categoryId, options = {}) {
  const id = String(categoryId || "").trim();
  if (!id) throw new Error("Thiếu danh mục cần xóa.");

  const currentItems = await listExpenseCategories(uid);
  const current = currentItems.find((item) => item.id === id);
  if (!current) throw new Error("Không tìm thấy danh mục cần xóa.");
  if (currentItems.length <= 1) {
    throw new Error("Cần giữ lại ít nhất 1 danh mục.");
  }
  if (currentItems.some((item) => String(item.parentId || "") === id)) {
    throw new Error("Hãy xóa hoặc chuyển các danh mục con trước.");
  }

  const categoryKey = String(current.key || current.id).trim();
  const legacyKey = String(current.legacyKey || "").trim();
  const keysToClear = [...new Set([categoryKey, legacyKey, id].filter(Boolean))];
  const replacementId = String(options?.replacementCategoryId || "").trim();

  let hasUsage = false;
  for (const key of keysToClear) {
    if (await hasAnyTransactionForCategory(uid, key)) {
      hasUsage = true;
      break;
    }
  }

  if (hasUsage) {
    const replacement = currentItems.find((item) => item.id === replacementId);
    if (!replacement || replacement.id === id) {
      throw new Error("Danh mục này đang có giao dịch. Vui lòng chọn danh mục khác để chuyển dữ liệu.");
    }
    const toKey = String(replacement.key || replacement.id).trim();
    for (const fromKey of keysToClear) {
      if (fromKey !== toKey) {
        await reassignTransactionsToExpenseCategory(uid, fromKey, toKey);
      }
    }
  }

  await deleteDoc(doc(db, `users/${uid}/expenseCategories/${id}`));
  return true;
}

export async function listLoanParties(uid) {
  const snap = await getDocs(colLoanParties(uid));
  return sortLoanParties(snap.docs.map((item) => mapLoanPartyDoc({ id: item.id, ...item.data() })));
}

export async function createLoanParty(uid, payload = {}) {
  const name = normalizeExpenseScopeName(payload?.name);
  const note = String(payload?.note || "").trim();
  if (!name) throw new Error("Vui lòng nhập tên người mượn.");

  const currentItems = await listLoanParties(uid);
  const nextNameLower = name.toLowerCase();
  if (currentItems.some((item) => item.nameLower === nextNameLower)) {
    throw new Error("Người mượn này đã tồn tại.");
  }

  const ref = await addDoc(colLoanParties(uid), {
    name,
    nameLower: nextNameLower,
    note,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return { id: ref.id };
}

export async function updateLoanParty(uid, partyId, payload = {}) {
  const id = String(partyId || "").trim();
  if (!id) throw new Error("Thiếu người mượn cần cập nhật.");

  const name = normalizeExpenseScopeName(payload?.name);
  const note = String(payload?.note || "").trim();
  if (!name) throw new Error("Vui lòng nhập tên người mượn.");

  const currentItems = await listLoanParties(uid);
  const nextNameLower = name.toLowerCase();
  if (currentItems.some((item) => item.id !== id && item.nameLower === nextNameLower)) {
    throw new Error("Người mượn này đã tồn tại.");
  }

  await updateDoc(doc(db, `users/${uid}/loanParties/${id}`), {
    name,
    nameLower: nextNameLower,
    note,
    updatedAt: Timestamp.now(),
  });
  return true;
}

export async function deleteLoanParty(uid, partyId = "") {
  const id = String(partyId || "").trim();
  if (!id) throw new Error("Thiếu người mượn cần xóa.");

  const currentItems = await listLoanParties(uid);
  if (!currentItems.some((item) => item.id === id)) {
    throw new Error("Không tìm thấy người mượn.");
  }

  const snap = await getDocs(query(colTransactions(uid), where("loanPartyId", "==", id), limit(1)));
  if (!snap.empty) {
    throw new Error("Người mượn này đang có lịch sử cho mượn hoặc trả lại, chưa thể xóa.");
  }

  await deleteDoc(doc(db, `users/${uid}/loanParties/${id}`));
  return true;
}

export async function listScopeBudgets(uid, monthKey = "") {
  const normalizedMonth = normalizeMonthKey(monthKey);
  const snap = await getDocs(query(colScopeBudgets(uid), where("monthKey", "==", normalizedMonth)));
  return sortScopeBudgets(
    snap.docs.map((item) => mapScopeBudgetDoc({ id: item.id, ...item.data() }))
  );
}

export async function saveScopeBudget(uid, payload = {}) {
  const scopeId = String(payload?.scopeId || "").trim();
  const monthKey = normalizeMonthKey(payload?.monthKey);
  const limitAmount = Number(payload?.limitAmount || 0);

  if (!scopeId) throw new Error("Thiếu nhóm chi cho ngân sách.");
  if (!Number.isFinite(limitAmount) || !(limitAmount > 0)) {
    throw new Error("Ngân sách phải lớn hơn 0.");
  }

  const scopeItems = await listExpenseScopes(uid);
  if (!scopeItems.some((item) => item.id === scopeId)) {
    throw new Error("Không tìm thấy nhóm chi cho ngân sách.");
  }

  const currentItems = await listScopeBudgets(uid, monthKey);
  const existing = currentItems.find((item) => item.scopeId === scopeId);
  const nextPayload = {
    scopeId,
    monthKey,
    limitAmount,
    updatedAt: Timestamp.now(),
  };

  if (existing?.id) {
    await updateDoc(docScopeBudget(uid, existing.id), nextPayload);
    return { id: existing.id, action: "updated" };
  }

  const ref = await addDoc(colScopeBudgets(uid), {
    ...nextPayload,
    createdAt: Timestamp.now(),
  });
  return { id: ref.id, action: "created" };
}

export async function deleteScopeBudget(uid, budgetId = "") {
  const id = String(budgetId || "").trim();
  if (!id) throw new Error("Thiếu ngân sách cần xóa.");
  await deleteDoc(docScopeBudget(uid, id));
  return true;
}

export async function createExpenseScope(uid, payload = {}) {
  const name = normalizeExpenseScopeName(payload?.name);
  if (!name) throw new Error("Vui lòng nhập tên nhóm chi.");

  const currentItems = await listExpenseScopes(uid);
  const nextNameLower = name.toLowerCase();
  if (currentItems.some((item) => item.nameLower === nextNameLower)) {
    throw new Error("Nhóm chi này đã tồn tại.");
  }

  const maxSortOrder = currentItems.reduce((acc, item) => Math.max(acc, Number(item?.sortOrder || 0)), 0);
  const ref = await addDoc(colExpenseScopes(uid), {
    name,
    nameLower: nextNameLower,
    sortOrder: maxSortOrder + 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return { id: ref.id };
}

export async function updateExpenseScope(uid, scopeId, payload = {}) {
  const id = String(scopeId || "").trim();
  if (!id) throw new Error("Thiếu nhóm chi cần cập nhật.");

  const name = normalizeExpenseScopeName(payload?.name);
  if (!name) throw new Error("Vui lòng nhập tên nhóm chi.");

  const currentItems = await listExpenseScopes(uid);
  const nextNameLower = name.toLowerCase();
  if (currentItems.some((item) => item.id !== id && item.nameLower === nextNameLower)) {
    throw new Error("Nhóm chi này đã tồn tại.");
  }

  await updateDoc(doc(db, `users/${uid}/expenseScopes/${id}`), {
    name,
    nameLower: nextNameLower,
    updatedAt: Timestamp.now(),
  });
  return true;
}

async function hasAnyTransactionForScope(uid, scopeId = "") {
  const id = String(scopeId || "").trim();
  if (!id) return false;

  const snap = await getDocs(query(colTransactions(uid), where("scopeId", "==", id), limit(20)));
  return snap.docs.some((item) => normalizeLedgerTransactionType(item.data()?.type) === "expense");
}

async function hasAnyBudgetForScope(uid, scopeId = "") {
  const id = String(scopeId || "").trim();
  if (!id) return false;

  const snap = await getDocs(query(colScopeBudgets(uid), where("scopeId", "==", id), limit(1)));
  return !snap.empty;
}

async function reassignTransactionsToExpenseScope(uid, fromScopeId = "", toScopeId = "") {
  const fromId = String(fromScopeId || "").trim();
  const toId = String(toScopeId || "").trim();
  if (!fromId || !toId || fromId === toId) return 0;

  const snap = await getDocs(query(colTransactions(uid), where("scopeId", "==", fromId)));
  if (snap.empty) return 0;

  const docs = snap.docs.filter(
    (item) => normalizeLedgerTransactionType(item.data()?.type) === "expense"
  );
  if (!docs.length) return 0;

  let updatedCount = 0;
  while (docs.length) {
    const chunk = docs.splice(0, 400);
    const batch = writeBatch(db);
    const now = Timestamp.now();
    chunk.forEach((item) => {
      batch.update(item.ref, {
        scopeId: toId,
        updatedAt: now,
      });
    });
    await batch.commit();
    updatedCount += chunk.length;
  }

  return updatedCount;
}

async function reassignScopeBudgets(uid, fromScopeId = "", toScopeId = "") {
  const fromId = String(fromScopeId || "").trim();
  const toId = String(toScopeId || "").trim();
  if (!fromId || !toId || fromId === toId) return 0;

  const snap = await getDocs(query(colScopeBudgets(uid), where("scopeId", "==", fromId)));
  if (snap.empty) return 0;

  const currentBudgets = snap.docs.map((item) => ({
    ref: item.ref,
    ...mapScopeBudgetDoc({ id: item.id, ...item.data() }),
  }));
  const replacementSnap = await getDocs(query(colScopeBudgets(uid), where("scopeId", "==", toId)));
  const replacementByMonth = new Map(
    replacementSnap.docs.map((item) => {
      const mapped = mapScopeBudgetDoc({ id: item.id, ...item.data() });
      return [mapped.monthKey, { ref: item.ref, ...mapped }];
    })
  );

  let updatedCount = 0;
  while (currentBudgets.length) {
    const chunk = currentBudgets.splice(0, 200);
    const batch = writeBatch(db);
    const now = Timestamp.now();

    chunk.forEach((budget) => {
      const replacement = replacementByMonth.get(budget.monthKey);
      if (replacement?.ref) {
        const nextLimitAmount =
          Number(replacement.limitAmount || 0) + Number(budget.limitAmount || 0);
        batch.update(replacement.ref, {
          limitAmount: nextLimitAmount,
          updatedAt: now,
        });
        replacement.limitAmount = nextLimitAmount;
        batch.delete(budget.ref);
      } else {
        batch.update(budget.ref, {
          scopeId: toId,
          updatedAt: now,
        });
        replacementByMonth.set(budget.monthKey, {
          ...budget,
          ref: budget.ref,
          scopeId: toId,
        });
      }
      updatedCount += 1;
    });

    await batch.commit();
  }

  return updatedCount;
}

export async function deleteExpenseScope(uid, scopeId, options = {}) {
  const id = String(scopeId || "").trim();
  if (!id) throw new Error("Thiếu nhóm chi cần xóa.");

  const currentItems = await listExpenseScopes(uid);
  const currentScope = currentItems.find((item) => item.id === id);
  if (!currentScope) throw new Error("Không tìm thấy nhóm chi cần xóa.");
  if (currentItems.length <= 1) {
    throw new Error("Cần giữ lại ít nhất 1 nhóm chi.");
  }

  const replacementScopeId = String(options?.replacementScopeId || "").trim();
  const hasUsage = await hasAnyTransactionForScope(uid, id);
  const hasBudgets = await hasAnyBudgetForScope(uid, id);

  if (hasUsage) {
    if (!replacementScopeId || replacementScopeId === id) {
      throw new Error("Nhóm chi này đang có giao dịch. Vui lòng chọn nhóm khác để chuyển dữ liệu.");
    }
    if (!currentItems.some((item) => item.id === replacementScopeId)) {
      throw new Error("Nhóm chi thay thế không hợp lệ.");
    }
    await reassignTransactionsToExpenseScope(uid, id, replacementScopeId);
  }

  if (hasBudgets) {
    if (!replacementScopeId || replacementScopeId === id) {
      throw new Error("Nhóm chi này đang có ngân sách tháng. Vui lòng chọn nhóm khác để chuyển dữ liệu.");
    }
    if (!currentItems.some((item) => item.id === replacementScopeId)) {
      throw new Error("Nhóm chi thay thế không hợp lệ.");
    }
    await reassignScopeBudgets(uid, id, replacementScopeId);
  }

  await deleteDoc(doc(db, `users/${uid}/expenseScopes/${id}`));
  return true;
}

export async function createAccount(uid, payload = {}) {
  const name = String(payload?.name || "").trim();
  const openingBalance = Number(payload?.openingBalance || 0);
  if (!name) throw new Error("Vui lòng nhập tên tài khoản.");
  if (!Number.isFinite(openingBalance)) throw new Error("Số dư đầu kỳ không hợp lệ.");

  const currentAccounts = await listAccountsWithBalances(uid);
  if (
    currentAccounts.some((item) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase())
  ) {
    throw new Error("Tên tài khoản đã tồn tại.");
  }

  const isDefault = currentAccounts.length === 0 ? true : !!payload?.isDefault;
  const moneyOwner = normalizeAccountMoneyOwner(payload?.moneyOwner);
  const ref = await addDoc(colAccounts(uid), {
    name,
    type: normalizeLedgerAccountType(payload?.type),
    openingBalance,
    currentBalance: openingBalance,
    isDefault,
    moneyOwner,
    status: "active",
    schemaVersion: LEDGER_SCHEMA_VERSION,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  if (isDefault) {
    await clearDefaultFlagForOtherAccounts(uid, ref.id);
  }

  return { id: ref.id };
}

export async function updateLedgerAccount(uid, accountId = "", payload = {}) {
  const id = String(accountId || "").trim();
  if (!id) throw new Error("Thiếu tài khoản cần cập nhật.");

  const accountRef = docAccount(uid, id);
  const snap = await getDoc(accountRef);
  if (!snap.exists()) throw new Error("Không tìm thấy tài khoản.");

  const data = snap.data() || {};
  if (Number(data?.schemaVersion || 0) !== LEDGER_SCHEMA_VERSION) {
    throw new Error("Tài khoản không thuộc workspace tài chính mới.");
  }
  if (String(data?.status || "active") === "archived") {
    throw new Error("Không thể sửa tài khoản đã lưu trữ.");
  }

  const name = String(payload?.name ?? data?.name ?? "").trim();
  const type = normalizeLedgerAccountType(payload?.type ?? data?.type);
  const isDefault = typeof payload?.isDefault === "boolean" ? payload.isDefault : !!data?.isDefault;
  const moneyOwner = normalizeAccountMoneyOwner(
    Object.prototype.hasOwnProperty.call(payload || {}, "moneyOwner")
      ? payload?.moneyOwner
      : data?.moneyOwner
  );

  if (!name) throw new Error("Vui lòng nhập tên tài khoản.");

  const currentAccounts = await listAccountsWithBalances(uid);
  if (
    currentAccounts.some(
      (item) =>
        item.id !== id && String(item?.name || "").trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error("Tên tài khoản đã tồn tại.");
  }

  await updateDoc(accountRef, {
    name,
    type,
    isDefault,
    moneyOwner,
    updatedAt: Timestamp.now(),
  });

  if (isDefault) {
    await clearDefaultFlagForOtherAccounts(uid, id);
  } else if (data?.isDefault && !isDefault) {
    await ensureActiveDefaultAccount(uid);
  }

  return { id };
}

async function applyLedgerDiffTransaction(txContext, uid, diff = new Map()) {
  const balanceChanges = Array.from(diff.entries()).filter(
    ([accountId, delta]) => accountId && Number.isFinite(delta) && delta !== 0
  );
  if (!balanceChanges.length) return;

  const updatedAt = Timestamp.now();
  balanceChanges.forEach(([accountId, delta]) => {
    const accountRef = docAccount(uid, accountId);
    txContext.update(accountRef, {
      currentBalance: increment(delta),
      updatedAt,
    });
  });
}

export async function createTransaction(uid, payload = {}) {
  const normalized = normalizeLedgerTransactionInput(payload);
  const transactionRef = doc(colTransactions(uid));
  await runTransaction(db, async (txContext) => {
    const nextEffects = buildLedgerEffects(normalized);
    await applyLedgerDiffTransaction(txContext, uid, nextEffects);
    txContext.set(
      transactionRef,
      buildLedgerTransactionDocData(normalized, {
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    );
  });
  return { id: transactionRef.id };
}

export async function updateTransaction(uid, transactionId, payload = {}) {
  const transactionRef = docTransaction(uid, transactionId);
  await runTransaction(db, async (txContext) => {
    const currentSnap = await txContext.get(transactionRef);
    if (!currentSnap.exists()) throw new Error("Không tìm thấy giao dịch.");
    const currentData = currentSnap.data() || {};
    if (Number(currentData?.schemaVersion || 0) !== LEDGER_SCHEMA_VERSION) {
      throw new Error("Giao dịch không thuộc workspace tài chính mới.");
    }

    const normalized = normalizeLedgerTransactionInput(payload);
    const nextData = {
      ...normalized,
      createdAt: currentData?.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const diff = diffLedgerEffects(buildLedgerEffects(currentData), buildLedgerEffects(nextData));
    await applyLedgerDiffTransaction(txContext, uid, diff);
    txContext.update(
      transactionRef,
      buildLedgerTransactionDocData(nextData, {
        createdAt: currentData?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        forUpdate: true,
      })
    );
  });
  return true;
}

export async function deleteTransaction(uid, transactionId) {
  const transactionRef = docTransaction(uid, transactionId);
  await runTransaction(db, async (txContext) => {
    const currentSnap = await txContext.get(transactionRef);
    if (!currentSnap.exists()) throw new Error("Không tìm thấy giao dịch.");
    const currentData = currentSnap.data() || {};
    if (Number(currentData?.schemaVersion || 0) !== LEDGER_SCHEMA_VERSION) {
      throw new Error("Giao dịch không thuộc workspace tài chính mới.");
    }

    const diff = diffLedgerEffects(buildLedgerEffects(currentData), new Map());
    await applyLedgerDiffTransaction(txContext, uid, diff);
    txContext.delete(transactionRef);
  });
  return true;
}

function mapLedgerTransactionRows(snapshot) {
  return mapDocs(snapshot)
    .filter((item) => Number(item?.schemaVersion || 0) === LEDGER_SCHEMA_VERSION)
    .map((item) => {
      const type = normalizeLedgerTransactionType(item?.type);
      return {
        id: item.id,
        type,
        amount: Number(item?.amount || 0),
        occurredAt: item?.occurredAt || null,
        accountId: String(item?.accountId || "").trim(),
        toAccountId: type === "transfer" ? String(item?.toAccountId || "").trim() : "",
        categoryKey: type === "expense" ? String(item?.categoryKey || "").trim() : "",
        scopeId: type === "expense" ? String(item?.scopeId || "").trim() : "",
        loanPartyId: type === "loan_lend" || type === "loan_repay" ? String(item?.loanPartyId || "").trim() : "",
        interestRate: type === "loan_lend" ? Math.max(0, Number(item?.interestRate || 0)) : 0,
        moneyOwner: Object.prototype.hasOwnProperty.call(item || {}, "moneyOwner")
          ? normalizeMoneyOwner(item?.moneyOwner)
          : "unassigned",
        note: String(item?.note || "").trim(),
        createdAt: item?.createdAt || null,
        updatedAt: item?.updatedAt || null,
      };
    });
}

export async function listLoanTransactions(uid) {
  const [lendSnap, repaySnap] = await Promise.all([
    getDocs(query(colTransactions(uid), where("type", "==", "loan_lend"))),
    getDocs(query(colTransactions(uid), where("type", "==", "loan_repay"))),
  ]);

  return mapLedgerTransactionRows({
    docs: [...lendSnap.docs, ...repaySnap.docs],
  }).sort((a, b) => {
    const aMs = a?.occurredAt?.toMillis?.() ?? 0;
    const bMs = b?.occurredAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

export async function listTransactions(uid, options = {}) {
  const ym = String(options?.month || "").trim();
  const fromDate = String(options?.fromDate || "").trim();
  const toDate = String(options?.toDate || "").trim();
  const explicitRange = dateInputRangeToTimestamps(fromDate, toDate);
  const monthRange = ymToRange(ym);
  const range = explicitRange || monthRange;

  let qy = query(colTransactions(uid), orderBy("occurredAt", "desc"));
  if (range?.start && range?.end) {
    qy = query(
      colTransactions(uid),
      where("occurredAt", ">=", range.start),
      where("occurredAt", "<", range.end),
      orderBy("occurredAt", "desc")
    );
  } else if (range?.start) {
    qy = query(
      colTransactions(uid),
      where("occurredAt", ">=", range.start),
      orderBy("occurredAt", "desc")
    );
  } else if (range?.end) {
    qy = query(
      colTransactions(uid),
      where("occurredAt", "<", range.end),
      orderBy("occurredAt", "desc")
    );
  }

  const snap = await getDocs(qy);
  return mapLedgerTransactionRows(snap);
}

export async function archiveAccount(uid, accountId = "") {
  const id = String(accountId || "").trim();
  if (!id) throw new Error("Thiếu tài khoản cần cập nhật.");

  const accountRef = docAccount(uid, id);
  const snap = await getDoc(accountRef);
  if (!snap.exists()) throw new Error("Không tìm thấy tài khoản.");

  const data = snap.data() || {};
  if (Number(data?.schemaVersion || 0) !== LEDGER_SCHEMA_VERSION) {
    throw new Error("Tài khoản không thuộc workspace tài chính mới.");
  }

  const hasTransactions = await hasAnyTransactionForAccount(uid, id);
  if (!hasTransactions) {
    await deleteDoc(accountRef);
    await ensureActiveDefaultAccount(uid);
    return { action: "deleted" };
  }

  await updateDoc(accountRef, {
    status: "archived",
    isDefault: false,
    updatedAt: Timestamp.now(),
  });
  await ensureActiveDefaultAccount(uid);
  return { action: "archived" };
}

async function deleteCollectionDocsByRef(colRef) {
  const snap = await getDocs(colRef);
  if (snap.empty) return;
  const docs = [...snap.docs];
  while (docs.length) {
    const chunk = docs.splice(0, 400);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.delete(item.ref);
    });
    await batch.commit();
  }
}

export async function listRecurringRules(uid) {
  const snap = await getDocs(colRecurringRules(uid));
  return mapDocs(snap)
    .map((item) => ({
      id: item.id,
      type: String(item?.type || "expense").trim() === "income" ? "income" : "expense",
      amount: Math.round(Number(item?.amount || 0)),
      categoryKey: String(item?.categoryKey || "").trim(),
      scopeId: String(item?.scopeId || "").trim(),
      accountId: String(item?.accountId || "").trim(),
      note: String(item?.note || "").trim(),
      dayOfMonth: Math.min(28, Math.max(1, Math.round(Number(item?.dayOfMonth || 1)))),
      active: item?.active !== false,
      lastGeneratedYm: String(item?.lastGeneratedYm || "").trim(),
      createdAt: item?.createdAt || null,
    }))
    .sort((a, b) => {
      const aMs = a?.createdAt?.toMillis?.() ?? 0;
      const bMs = b?.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
}

export async function createRecurringRule(uid, payload = {}) {
  const type = String(payload?.type || "expense").trim() === "income" ? "income" : "expense";
  const amount = Math.round(Number(payload?.amount || 0));
  const dayOfMonth = Math.round(Number(payload?.dayOfMonth || 0));
  const accountId = String(payload?.accountId || "").trim();
  if (!(amount > 0)) throw new Error("Số tiền phải lớn hơn 0.");
  if (!(dayOfMonth >= 1 && dayOfMonth <= 28)) throw new Error("Ngày trong tháng phải từ 1 đến 28.");
  if (!accountId) throw new Error("Vui lòng chọn tài khoản.");

  const ref = await addDoc(colRecurringRules(uid), {
    type,
    amount,
    categoryKey: type === "expense" ? String(payload?.categoryKey || "other").trim() || "other" : "",
    scopeId: type === "expense" ? String(payload?.scopeId || "").trim() : "",
    accountId,
    note: String(payload?.note || "").trim(),
    dayOfMonth,
    active: payload?.active !== false,
    createdAt: Timestamp.now(),
  });
  return { id: ref.id };
}

export async function updateRecurringRule(uid, ruleId = "", payload = {}) {
  const id = String(ruleId || "").trim();
  if (!id) throw new Error("Thiếu mã mẫu định kỳ.");
  const patch = { updatedAt: Timestamp.now() };
  if (payload?.lastGeneratedYm !== undefined) {
    patch.lastGeneratedYm = String(payload.lastGeneratedYm || "").trim();
  }
  if (payload?.active !== undefined) patch.active = payload.active !== false;
  if (payload?.note !== undefined) patch.note = String(payload.note || "").trim();
  if (payload?.amount !== undefined) patch.amount = Math.round(Number(payload.amount || 0));
  if (payload?.dayOfMonth !== undefined) {
    patch.dayOfMonth = Math.min(28, Math.max(1, Math.round(Number(payload.dayOfMonth || 1))));
  }
  await updateDoc(doc(db, `users/${uid}/recurringRules/${id}`), patch);
  return true;
}

export async function deleteRecurringRule(uid, ruleId = "") {
  const id = String(ruleId || "").trim();
  if (!id) throw new Error("Thiếu mã mẫu định kỳ.");
  await deleteDoc(doc(db, `users/${uid}/recurringRules/${id}`));
  return true;
}

export async function listSavingsGoals(uid) {
  const snap = await getDocs(colSavingsGoals(uid));
  return mapDocs(snap)
    .map((item) => ({
      id: item.id,
      name: String(item?.name || "").trim(),
      targetAmount: Math.round(Number(item?.targetAmount || 0)),
      currentAmount: Math.round(Number(item?.currentAmount || 0)),
      note: String(item?.note || "").trim(),
      createdAt: item?.createdAt || null,
    }))
    .sort((a, b) => {
      const aMs = a?.createdAt?.toMillis?.() ?? 0;
      const bMs = b?.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
}

export async function createSavingsGoal(uid, payload = {}) {
  const name = String(payload?.name || "").trim();
  const targetAmount = Math.round(Number(payload?.targetAmount || 0));
  const currentAmount = Math.max(0, Math.round(Number(payload?.currentAmount || 0)));
  if (!name) throw new Error("Vui lòng nhập tên mục tiêu.");
  if (!(targetAmount > 0)) throw new Error("Mục tiêu phải lớn hơn 0.");

  const ref = await addDoc(colSavingsGoals(uid), {
    name,
    targetAmount,
    currentAmount,
    note: String(payload?.note || "").trim(),
    createdAt: Timestamp.now(),
  });
  return { id: ref.id };
}

export async function updateSavingsGoal(uid, goalId = "", payload = {}) {
  const id = String(goalId || "").trim();
  if (!id) throw new Error("Thiếu mã mục tiêu.");
  const patch = { updatedAt: Timestamp.now() };
  if (payload?.name !== undefined) patch.name = String(payload.name || "").trim();
  if (payload?.targetAmount !== undefined) patch.targetAmount = Math.round(Number(payload.targetAmount || 0));
  if (payload?.currentAmount !== undefined) {
    patch.currentAmount = Math.max(0, Math.round(Number(payload.currentAmount || 0)));
  }
  if (payload?.note !== undefined) patch.note = String(payload.note || "").trim();
  await updateDoc(doc(db, `users/${uid}/savingsGoals/${id}`), patch);
  return true;
}

export async function deleteSavingsGoal(uid, goalId = "") {
  const id = String(goalId || "").trim();
  if (!id) throw new Error("Thiếu mã mục tiêu.");
  await deleteDoc(doc(db, `users/${uid}/savingsGoals/${id}`));
  return true;
}

export async function resetFinanceData(uid) {
  await deleteCollectionDocsByRef(colTransactions(uid));
  await deleteCollectionDocsByRef(colExpenseScopes(uid));
  await deleteCollectionDocsByRef(colScopeBudgets(uid));
  await deleteCollectionDocsByRef(colLoanParties(uid));
  await deleteCollectionDocsByRef(colRecurringRules(uid));
  await deleteCollectionDocsByRef(colSavingsGoals(uid));
  await deleteCollectionDocsByRef(colExpenses(uid));
  await deleteCollectionDocsByRef(colIncomes(uid));
  await deleteCollectionDocsByRef(colTransfers(uid));
  await deleteCollectionDocsByRef(colAccounts(uid));
  return true;
}
