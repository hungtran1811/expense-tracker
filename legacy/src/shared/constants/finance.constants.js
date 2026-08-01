export const FINANCE_CATEGORIES = Object.freeze([
  { key: "food", label: "Ăn uống" },
  { key: "coffee", label: "Cà phê" },
  { key: "housing", label: "Nhà ở" },
  { key: "transport", label: "Di chuyển" },
  { key: "personal", label: "Cá nhân" },
  { key: "health", label: "Sức khỏe" },
  { key: "family", label: "Gia đình" },
  { key: "education", label: "Học tập" },
  { key: "entertainment", label: "Giải trí" },
  { key: "other", label: "Khác" },
]);

/** Runtime cache — set from bootstrap after listExpenseCategories. */
let _expenseCategoryCache = [];

export function setExpenseCategoryCache(categories = []) {
  _expenseCategoryCache = Array.isArray(categories) ? categories : [];
}

export function getExpenseCategoryCache() {
  return _expenseCategoryCache;
}

/** Resolve label from dynamic categories (Phase 1) with legacy fallback. */
export function resolveExpenseCategory(key = "", categories = _expenseCategoryCache) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  const list = Array.isArray(categories) && categories.length ? categories : _expenseCategoryCache;
  return (
    list.find((item) => String(item?.id || "").trim() === raw) ||
    list.find((item) => String(item?.key || "").trim() === raw) ||
    list.find((item) => String(item?.legacyKey || "").trim() === raw) ||
    null
  );
}

export function getExpenseCategoryOptions(categories = _expenseCategoryCache) {
  const list = Array.isArray(categories) && categories.length ? categories : _expenseCategoryCache;
  if (!list.length) {
    return FINANCE_CATEGORIES.map((item) => ({
      key: item.key,
      value: item.key,
      label: item.label,
      parentId: "",
    }));
  }
  // Phase 1: flat list (parentId empty). Phase 2 can nest by parentId.
  return list
    .filter((item) => !String(item?.parentId || "").trim())
    .map((item) => ({
      key: String(item.key || item.id).trim(),
      value: String(item.key || item.id).trim(),
      label: String(item.name || "").trim(),
      parentId: String(item.parentId || "").trim(),
      id: item.id,
    }));
}

export function getFinanceCategoryLabel(key = "", categories = _expenseCategoryCache) {
  const found = resolveExpenseCategory(key, categories);
  if (found?.name) return found.name;
  const legacy = FINANCE_CATEGORIES.find((item) => item.key === String(key || "").trim());
  return legacy?.label || "Khác";
}
export const ACCOUNT_TYPE_OPTIONS = Object.freeze([
  { key: "bank", label: "Ngân hàng" },
  { key: "wallet", label: "Ví điện tử" },
  { key: "cash", label: "Tiền mặt" },
  { key: "savings", label: "Tiết kiệm" },
  { key: "other", label: "Khác" },
]);

export const TRANSACTION_TYPE_OPTIONS = Object.freeze([
  { key: "expense", label: "Khoản chi" },
  { key: "income", label: "Khoản thu" },
  { key: "transfer", label: "Chuyển khoản" },
  { key: "adjustment", label: "Điều chỉnh" },
  { key: "loan_lend", label: "Cho mượn" },
  { key: "loan_repay", label: "Nhận trả" },
]);

export const FINANCE_TRANSACTION_TYPE_OPTIONS = Object.freeze(
  TRANSACTION_TYPE_OPTIONS.filter((item) =>
    ["expense", "income", "transfer"].includes(item.key)
  )
);

export const LOAN_TRANSACTION_TYPE_OPTIONS = Object.freeze(
  TRANSACTION_TYPE_OPTIONS.filter((item) => ["loan_lend", "loan_repay"].includes(item.key))
);

export function getAccountTypeLabel(key = "") {
  const found = ACCOUNT_TYPE_OPTIONS.find((item) => item.key === String(key || "").trim());
  return found?.label || "Khác";
}

export function getTransactionTypeLabel(key = "") {
  const found = TRANSACTION_TYPE_OPTIONS.find((item) => item.key === String(key || "").trim());
  return found?.label || "Không rõ";
}
