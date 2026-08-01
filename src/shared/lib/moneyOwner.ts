export type MoneyOwner = "personal" | "mother" | "unassigned";

export const MONEY_OWNER_OPTIONS = [
  { key: "personal" as const, label: "Tiền của tôi" },
  { key: "mother" as const, label: "Tiền của mẹ" },
] as const;

export const MONEY_OWNER_FILTER_OPTIONS = [
  { key: "all" as const, label: "Tất cả" },
  { key: "personal" as const, label: "Tiền của tôi" },
  { key: "mother" as const, label: "Tiền của mẹ" },
  { key: "unassigned" as const, label: "Chưa phân loại" },
] as const;

export function normalizeMoneyOwner(value: unknown): MoneyOwner {
  const text = String(value || "").trim();
  if (text === "personal" || text === "mother" || text === "unassigned") return text;
  return "unassigned";
}

export function getMoneyOwnerLabel(owner: unknown): string {
  const normalized = normalizeMoneyOwner(owner);
  if (normalized === "personal") return "Tiền của tôi";
  if (normalized === "mother") return "Tiền của mẹ";
  return "Chưa phân loại";
}

export function requireMoneyOwner(value: unknown): "personal" | "mother" {
  const text = String(value || "").trim();
  if (text === "personal" || text === "mother") return text;
  throw new Error("Vui lòng chọn nguồn tiền.");
}

export function matchesMoneyOwnerFilter(
  owner: unknown,
  filter: string = "all"
): boolean {
  const target = String(filter || "all").trim() || "all";
  if (target === "all") return true;
  return normalizeMoneyOwner(owner) === target;
}

/** Chủ sở hữu gắn với ví: mặc định là tiền của tôi. */
export function normalizeAccountMoneyOwner(value: unknown): "personal" | "mother" {
  return String(value || "").trim() === "mother" ? "mother" : "personal";
}

/**
 * Nguồn tiền hiệu lực của giao dịch:
 * - đã gắn personal/mother trên giao dịch → dùng luôn
 * - chưa gắn → suy ra từ ví (VD: ví VP Bank gắn "mẹ")
 */
export function resolveTransactionMoneyOwner(
  tx: { moneyOwner?: unknown; accountId?: string; type?: unknown } | null | undefined,
  accounts: Array<{ id: string; moneyOwner?: unknown }> = []
): MoneyOwner {
  if (!tx) return "unassigned";
  if (String(tx.type || "") === "transfer") return "unassigned";

  const direct = normalizeMoneyOwner(tx.moneyOwner);
  if (direct === "personal" || direct === "mother") return direct;

  const account = accounts.find((item) => item.id === String(tx.accountId || ""));
  if (account) return normalizeAccountMoneyOwner(account.moneyOwner);
  return "unassigned";
}
