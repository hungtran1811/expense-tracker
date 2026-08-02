export type MoneyOwner = "personal" | "mother" | "unassigned";

export type OwnerLabels = {
  personal: string;
  mother: string;
  unassigned: string;
};

export const DEFAULT_OWNER_LABELS: OwnerLabels = {
  personal: "Tiền của tôi",
  mother: "Tiền của mẹ",
  unassigned: "Chưa phân loại",
};

export function normalizeOwnerLabels(raw: unknown): OwnerLabels {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const personal = String(data.personal || "").trim() || DEFAULT_OWNER_LABELS.personal;
  const mother = String(data.mother || "").trim() || DEFAULT_OWNER_LABELS.mother;
  return {
    personal: personal.slice(0, 40),
    mother: mother.slice(0, 40),
    unassigned: DEFAULT_OWNER_LABELS.unassigned,
  };
}

export function buildMoneyOwnerOptions(labels: OwnerLabels = DEFAULT_OWNER_LABELS) {
  return [
    { key: "personal" as const, label: labels.personal },
    { key: "mother" as const, label: labels.mother },
  ];
}

export function buildMoneyOwnerFilterOptions(labels: OwnerLabels = DEFAULT_OWNER_LABELS) {
  return [
    { key: "all" as const, label: "Tất cả" },
    { key: "personal" as const, label: labels.personal },
    { key: "mother" as const, label: labels.mother },
    { key: "unassigned" as const, label: labels.unassigned },
  ];
}

/** @deprecated Dùng buildMoneyOwnerOptions(labels) khi có nhãn tùy chỉnh. */
export const MONEY_OWNER_OPTIONS = buildMoneyOwnerOptions();

/** @deprecated Dùng buildMoneyOwnerFilterOptions(labels) khi có nhãn tùy chỉnh. */
export const MONEY_OWNER_FILTER_OPTIONS = buildMoneyOwnerFilterOptions();

export function normalizeMoneyOwner(value: unknown): MoneyOwner {
  const text = String(value || "").trim();
  if (text === "personal" || text === "mother" || text === "unassigned") return text;
  return "unassigned";
}

export function getMoneyOwnerLabel(
  owner: unknown,
  labels: OwnerLabels = DEFAULT_OWNER_LABELS
): string {
  const normalized = normalizeMoneyOwner(owner);
  return labels[normalized] || DEFAULT_OWNER_LABELS[normalized];
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
