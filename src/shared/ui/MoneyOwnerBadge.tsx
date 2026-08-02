import { normalizeMoneyOwner } from "../lib/moneyOwner";
import { useMoneyOwnerLabel } from "../hooks/useOwnerLabels";

export function MoneyOwnerBadge({ owner }: { owner: unknown }) {
  const normalized = normalizeMoneyOwner(owner);
  const label = useMoneyOwnerLabel(normalized);
  return <span className={`badge badge-${normalized}`}>{label}</span>;
}
