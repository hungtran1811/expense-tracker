import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MoneyOwnerSelector } from "../../shared/ui/MoneyOwnerSelector";
import { getTodayInputValue } from "../../shared/lib/date";
import { parseAmountInput } from "../../shared/lib/parseAmount";
import type { Account, ExpenseCategory, ExpenseScope, Transaction } from "../../shared/types/finance";
import { getMoneyOwnerLabel, normalizeAccountMoneyOwner, type MoneyOwner } from "../../shared/lib/moneyOwner";
import { useOwnerLabels } from "../../shared/hooks/useOwnerLabels";
import { suggestCategoryFromNote } from "../../services/ai/categorize";

export type TransactionDraft = {
  id?: string;
  type: "expense" | "income" | "transfer";
  accountId: string;
  toAccountId: string;
  amount: string;
  occurredAt: string;
  categoryKey: string;
  scopeId: string;
  moneyOwner: "personal" | "mother";
  note: string;
};

type Props = {
  accounts: Account[];
  scopes: ExpenseScope[];
  categories: ExpenseCategory[];
  initial?: Partial<TransactionDraft> | Transaction | null;
  submitting?: boolean;
  onSubmit: (draft: TransactionDraft) => Promise<void> | void;
  onCancel: () => void;
};

function ownerFromAccount(accounts: Account[], accountId: string): "personal" | "mother" {
  const account = accounts.find((item) => item.id === accountId);
  return account ? normalizeAccountMoneyOwner(account.moneyOwner) : "personal";
}

function accountForOwner(
  accounts: Account[],
  owner: "personal" | "mother",
  currentAccountId = ""
): string {
  const matched = accounts.filter((item) => normalizeAccountMoneyOwner(item.moneyOwner) === owner);
  if (!matched.length) return currentAccountId;
  if (matched.some((item) => item.id === currentAccountId)) return currentAccountId;
  return matched.find((item) => item.isDefault)?.id || matched[0]?.id || currentAccountId;
}

function toDraft(initial?: Partial<TransactionDraft> | Transaction | null, accounts: Account[] = []): TransactionDraft {
  const defaultAccount =
    accounts.find((item) => item.isDefault && String(item.status) !== "archived")?.id ||
    accounts.find((item) => String(item.status) !== "archived")?.id ||
    "";
  const accountId = String(
    (initial as Transaction)?.accountId || (initial as TransactionDraft)?.accountId || defaultAccount
  );
  const owner = (initial as Transaction)?.moneyOwner;
  const draftOwner = (initial as TransactionDraft)?.moneyOwner as MoneyOwner | undefined;
  const resolvedOwner =
    owner === "mother" || owner === "personal"
      ? owner
      : draftOwner === "mother" || draftOwner === "personal"
        ? draftOwner
        : ownerFromAccount(accounts, accountId);

  return {
    id: (initial as TransactionDraft)?.id || (initial as Transaction)?.id || "",
    type: ((initial as TransactionDraft)?.type || (initial as Transaction)?.type || "expense") as TransactionDraft["type"],
    accountId,
    toAccountId: String((initial as Transaction)?.toAccountId || (initial as TransactionDraft)?.toAccountId || ""),
    amount:
      (initial as TransactionDraft)?.amount != null
        ? String((initial as TransactionDraft).amount)
        : (initial as Transaction)?.amount != null
          ? String((initial as Transaction).amount)
          : "",
    occurredAt: String((initial as TransactionDraft)?.occurredAt || getTodayInputValue()),
    categoryKey: String((initial as Transaction)?.categoryKey || (initial as TransactionDraft)?.categoryKey || "other"),
    scopeId: String((initial as Transaction)?.scopeId || (initial as TransactionDraft)?.scopeId || ""),
    moneyOwner: resolvedOwner,
    note: String((initial as Transaction)?.note || (initial as TransactionDraft)?.note || ""),
  };
}

export function TransactionForm({
  accounts,
  scopes,
  categories,
  initial,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const { labels } = useOwnerLabels();
  const activeAccounts = useMemo(
    () => accounts.filter((item) => String(item.status || "active") !== "archived"),
    [accounts]
  );
  const [draft, setDraft] = useState<TransactionDraft>(() => toDraft(initial, activeAccounts));
  const [amountText, setAmountText] = useState(() => toDraft(initial, activeAccounts).amount);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const next = toDraft(initial, activeAccounts);
    setDraft(next);
    setAmountText(next.amount);
    setError("");
  }, [initial, activeAccounts]);

  const categoryOptions = categories.length
    ? categories
    : [
        { id: "other", key: "other", name: "Khác" },
        { id: "food", key: "food", name: "Ăn uống" },
      ];

  function applyAmountText(raw: string) {
    setAmountText(raw);
    const parsed = parseAmountInput(raw);
    if (parsed != null) {
      setDraft((current) => ({ ...current, amount: String(parsed) }));
    } else if (!String(raw || "").trim()) {
      setDraft((current) => ({ ...current, amount: "" }));
    }
  }

  async function handleAiSuggest() {
    if (draft.type !== "expense") return;
    setAiLoading(true);
    try {
      const key = await suggestCategoryFromNote(draft.note, categories.map((item) => item.key || item.id));
      if (key) setDraft((current) => ({ ...current, categoryKey: key }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gợi ý danh mục.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const parsed = parseAmountInput(amountText);
      if (!draft.accountId) throw new Error("Vui lòng chọn ví.");
      if (!draft.moneyOwner) throw new Error("Vui lòng chọn nguồn tiền.");
      if (parsed == null) throw new Error("Số tiền không hợp lệ (vd: 500000, 500k, 1.5tr).");
      if (draft.type === "expense" && !draft.scopeId) throw new Error("Vui lòng chọn nhóm chi.");
      if (draft.type === "transfer" && !draft.toAccountId) throw new Error("Vui lòng chọn ví nhận.");
      await onSubmit({ ...draft, amount: String(parsed) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu giao dịch.");
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor="tx-type">
          Loại giao dịch
        </label>
        <select
          id="tx-type"
          value={draft.type}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              type: event.target.value as TransactionDraft["type"],
            }))
          }
        >
          <option value="expense">Khoản chi</option>
          <option value="income">Khoản thu</option>
          <option value="transfer">Chuyển khoản</option>
        </select>
      </div>

      {draft.type !== "transfer" ? (
        <MoneyOwnerSelector
          value={draft.moneyOwner}
          onChange={(moneyOwner) =>
            setDraft((current) => ({
              ...current,
              moneyOwner,
              accountId: accountForOwner(activeAccounts, moneyOwner, current.accountId),
            }))
          }
          disabled={!!submitting}
        />
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="tx-account">
          Ví tiền
        </label>
        <select
          id="tx-account"
          value={draft.accountId}
          onChange={(event) => {
            const accountId = event.target.value;
            setDraft((current) => ({
              ...current,
              accountId,
              moneyOwner: ownerFromAccount(activeAccounts, accountId),
            }));
          }}
        >
          <option value="">Chọn ví</option>
          {activeAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {` · ${getMoneyOwnerLabel(normalizeAccountMoneyOwner(account.moneyOwner), labels)}`}
            </option>
          ))}
        </select>
      </div>

      {draft.type === "transfer" ? (
        <div className="field">
          <label className="field-label" htmlFor="tx-to">
            Ví nhận
          </label>
          <select
            id="tx-to"
            value={draft.toAccountId}
            onChange={(event) => setDraft((current) => ({ ...current, toAccountId: event.target.value }))}
          >
            <option value="">Chọn ví nhận</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="field">
          <label className="field-label" htmlFor="tx-amount">
            Số tiền
          </label>
          <input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            placeholder="500k hoặc 1.5tr"
            value={amountText}
            onChange={(event) => applyAmountText(event.target.value)}
            onBlur={() => {
              const parsed = parseAmountInput(amountText);
              if (parsed != null) setAmountText(String(parsed));
            }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tx-date">
            Ngày
          </label>
          <input
            id="tx-date"
            type="date"
            value={draft.occurredAt}
            onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))}
          />
        </div>
      </div>

      {draft.type === "expense" ? (
        <>
          <div className="field">
            <label className="field-label" htmlFor="tx-scope">
              Nhóm chi
            </label>
            <select
              id="tx-scope"
              value={draft.scopeId}
              onChange={(event) => setDraft((current) => ({ ...current, scopeId: event.target.value }))}
            >
              <option value="">Chọn nhóm chi</option>
              {scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="tx-category">
              Danh mục
            </label>
            <div className="toolbar-form">
              <select
                id="tx-category"
                className="field-control"
                value={draft.categoryKey}
                onChange={(event) => setDraft((current) => ({ ...current, categoryKey: event.target.value }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category.key || category.id} value={category.key || category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={aiLoading || !!submitting}
                onClick={() => void handleAiSuggest()}
              >
                {aiLoading ? "..." : "Gợi ý"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="tx-note">
          Ghi chú
        </label>
        <textarea
          id="tx-note"
          rows={3}
          value={draft.note}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        />
      </div>

      {error ? <div className="field-error">{error}</div> : null}

      <div className="page-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={!!submitting}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={!!submitting}>
          {submitting ? "Đang lưu..." : "Lưu giao dịch"}
        </button>
      </div>
    </form>
  );
}
