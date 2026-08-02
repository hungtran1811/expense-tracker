import type { CSSProperties } from "react";
import { formatCurrency } from "../lib/money";
import { resolveBankBrand } from "../lib/bankBrand";
import { getAccountTypeLabel } from "../constants/finance";

type Props = {
  name: string;
  type?: string;
  balance: number;
  meta?: string;
  isDefault?: boolean;
};

export function AccountBalanceCard({ name, type, balance, meta, isDefault }: Props) {
  const brand = resolveBankBrand(name, type);
  const style = {
    "--bank-accent": brand.accent,
    "--bank-soft": brand.soft,
    "--bank-ink": brand.ink,
  } as CSSProperties;

  return (
    <div className={`account-bank-card bank-${brand.key}`} style={style} data-bank={brand.key}>
      <div className="account-bank-card-main">
        <div className="account-bank-card-top">
          <span className="account-bank-chip">{brand.shortLabel}</span>
          {isDefault ? <span className="account-bank-default">Mặc định</span> : null}
        </div>
        <div className="account-bank-name u-ellipsis">{name}</div>
        <div className="account-bank-meta u-ellipsis">
          {meta || getAccountTypeLabel(type || "")}
        </div>
      </div>
      <strong className="account-bank-balance u-money">{formatCurrency(balance || 0)}</strong>
    </div>
  );
}
