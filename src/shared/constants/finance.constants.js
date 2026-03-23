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
]);

export function getFinanceCategoryLabel(key = "") {
  const found = FINANCE_CATEGORIES.find((item) => item.key === String(key || "").trim());
  return found?.label || "Khác";
}

export function getAccountTypeLabel(key = "") {
  const found = ACCOUNT_TYPE_OPTIONS.find((item) => item.key === String(key || "").trim());
  return found?.label || "Khác";
}

export function getTransactionTypeLabel(key = "") {
  const found = TRANSACTION_TYPE_OPTIONS.find((item) => item.key === String(key || "").trim());
  return found?.label || "Không rõ";
}

