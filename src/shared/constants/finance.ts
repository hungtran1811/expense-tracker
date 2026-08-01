export const FINANCE_CATEGORIES = [
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
] as const;

export const ACCOUNT_TYPE_OPTIONS = [
  { key: "bank", label: "Ngân hàng" },
  { key: "wallet", label: "Ví điện tử" },
  { key: "cash", label: "Tiền mặt" },
  { key: "savings", label: "Tiết kiệm" },
  { key: "other", label: "Khác" },
] as const;

export const TRANSACTION_TYPE_OPTIONS = [
  { key: "expense", label: "Khoản chi" },
  { key: "income", label: "Khoản thu" },
  { key: "transfer", label: "Chuyển khoản" },
  { key: "adjustment", label: "Điều chỉnh" },
  { key: "loan_lend", label: "Cho mượn" },
  { key: "loan_repay", label: "Nhận trả" },
] as const;

export function getAccountTypeLabel(key = "") {
  return ACCOUNT_TYPE_OPTIONS.find((item) => item.key === key)?.label || "Khác";
}

export function getTransactionTypeLabel(key = "") {
  return TRANSACTION_TYPE_OPTIONS.find((item) => item.key === key)?.label || "Không rõ";
}

export function getFinanceCategoryLabel(key = "", categories: Array<{ key?: string; id?: string; name?: string; legacyKey?: string }> = []) {
  const raw = String(key || "").trim();
  const found =
    categories.find((item) => item.id === raw) ||
    categories.find((item) => item.key === raw) ||
    categories.find((item) => item.legacyKey === raw);
  if (found?.name) return found.name;
  return FINANCE_CATEGORIES.find((item) => item.key === raw)?.label || "Khác";
}

export function isFinanceTransactionType(type = "") {
  return ["expense", "income", "transfer", "adjustment"].includes(String(type || "").trim());
}
