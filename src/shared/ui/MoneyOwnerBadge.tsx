import { getMoneyOwnerLabel, normalizeMoneyOwner } from "../lib/moneyOwner";

export function MoneyOwnerBadge({ owner }: { owner?: unknown }) {
  const normalized = normalizeMoneyOwner(owner);
  return <span className={`badge badge-${normalized}`}>{getMoneyOwnerLabel(normalized)}</span>;
}
