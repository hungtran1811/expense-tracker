import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import { getFinanceCategoryLabel, getTransactionTypeLabel } from "../constants/finance";
import { formatCurrency } from "../lib/money";
import { formatDateLabel } from "../lib/date";
import { resolveTransactionMoneyOwner } from "../lib/moneyOwner";
import { Modal } from "./Modal";
import { EmptyState } from "./EmptyState";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { transactions, accounts, categories, loanParties } = useWorkspaceContext();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return transactions
      .filter((tx) => {
        const account = accounts.find((item) => item.id === tx.accountId)?.name || "";
        const party = loanParties.find((item) => item.id === tx.loanPartyId)?.name || "";
        const hay = [
          tx.note,
          tx.type,
          tx.categoryKey,
          account,
          party,
          String(tx.amount || ""),
          formatCurrency(tx.amount || 0),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [query, transactions, accounts, loanParties]);

  return (
    <Modal open={open} title="Tìm giao dịch" onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label className="field-label" htmlFor="global-search">
            Từ khóa
          </label>
          <input
            id="global-search"
            autoFocus
            value={query}
            placeholder="VD: ăn uống, 500000, Thảo"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="list">
          {results.map((tx) => (
            <button
              key={tx.id}
              type="button"
              className="list-row clickable"
              onClick={() => {
                onClose();
                if (tx.type === "loan_lend" || tx.type === "loan_repay") {
                  navigate("/loans", { state: { editLoanId: tx.id } });
                } else {
                  navigate("/expenses", { state: { editTxId: tx.id } });
                }
              }}
            >
              <div className="list-main">
                <div className="list-title">
                  {tx.type === "expense"
                    ? getFinanceCategoryLabel(tx.categoryKey, categories)
                    : getTransactionTypeLabel(tx.type)}
                </div>
                <div className="list-meta">
                  <span>{formatDateLabel(tx.occurredAt)}</span>
                  <span>{accounts.find((item) => item.id === tx.accountId)?.name || "—"}</span>
                  <span>{resolveTransactionMoneyOwner(tx, accounts)}</span>
                  <span className="u-ellipsis">{tx.note || "Không ghi chú"}</span>
                </div>
              </div>
              <strong className="amount u-money">{formatCurrency(tx.amount || 0)}</strong>
            </button>
          ))}
          {query.trim() && !results.length ? <EmptyState title="Không tìm thấy giao dịch" /> : null}
          {!query.trim() ? <EmptyState title="Nhập từ khóa để tìm" /> : null}
        </div>
      </div>
    </Modal>
  );
}
