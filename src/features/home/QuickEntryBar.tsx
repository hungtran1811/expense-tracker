import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { Account, ExpenseCategory, ExpenseScope } from "../../shared/types/finance";
import { parseQuickEntry } from "../../shared/lib/quickEntry";
import { resolveDefaultScopeId } from "../../shared/lib/defaultScope";
import { getTodayInputValue } from "../../shared/lib/date";
import { suggestCategoryFromNoteSync } from "../../services/ai/categorize";
import { createTransaction } from "../../services/firebase/firestore";
import { useToast } from "../../shared/ui/Toast";
import type { TransactionDraft } from "../expenses/TransactionForm";

type Props = {
  ledgerUid: string;
  accounts: Account[];
  scopes: ExpenseScope[];
  categories: ExpenseCategory[];
  onRefresh: () => Promise<void> | void;
  onOpenForm: (type: "expense" | "income", initial: Partial<TransactionDraft>) => void;
};

function draftFromParsed(
  parsed: Exclude<ReturnType<typeof parseQuickEntry>, { error: string }>,
  scopes: ExpenseScope[],
  categoryKey = "other"
): Partial<TransactionDraft> {
  return {
    type: parsed.type,
    amount: String(parsed.amount),
    accountId: parsed.accountId,
    moneyOwner: parsed.moneyOwner,
    note: parsed.note,
    occurredAt: getTodayInputValue(),
    scopeId: parsed.type === "expense" ? resolveDefaultScopeId(scopes) : "",
    categoryKey,
    toAccountId: "",
  };
}

export function QuickEntryBar({
  ledgerUid,
  accounts,
  scopes,
  categories,
  onRefresh,
  onOpenForm,
}: Props) {
  const { showToast } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successPulse, setSuccessPulse] = useState(false);

  function openAsForm(parsed: Exclude<ReturnType<typeof parseQuickEntry>, { error: string }>) {
    onOpenForm(parsed.type, draftFromParsed(parsed, scopes));
  }

  async function saveParsed(parsed: Exclude<ReturnType<typeof parseQuickEntry>, { error: string }>) {
    if (!parsed.accountId) {
      setError("Chưa có ví. Tạo ví trong Quản lý trước.");
      return;
    }
    const scopeId = parsed.type === "expense" ? resolveDefaultScopeId(scopes) : "";
    if (parsed.type === "expense" && !scopeId) {
      setError("Chưa có nhóm chi. Thêm nhóm trong Quản lý.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const allowed = categories.map((item) => item.key || item.id).filter(Boolean);
      const categoryKey =
        parsed.type === "expense"
          ? suggestCategoryFromNoteSync(parsed.note, allowed) || "other"
          : "other";

      await createTransaction(ledgerUid, {
        type: parsed.type,
        amount: parsed.amount,
        accountId: parsed.accountId,
        moneyOwner: parsed.moneyOwner,
        note: parsed.note,
        occurredAt: getTodayInputValue(),
        scopeId,
        categoryKey: parsed.type === "expense" ? categoryKey : "",
      });

      setValue("");
      setSuccessPulse(true);
      window.setTimeout(() => setSuccessPulse(false), 700);
      showToast(
        parsed.type === "income"
          ? `+${parsed.amount.toLocaleString("vi-VN")}đ`
          : `−${parsed.amount.toLocaleString("vi-VN")}đ`,
        "success"
      );
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể lưu.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const parsed = parseQuickEntry(value, accounts);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (parsed.needsForm) {
      openAsForm(parsed);
      return;
    }
    await saveParsed(parsed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      const parsed = parseQuickEntry(value, accounts);
      if ("error" in parsed) {
        setError(parsed.error);
        return;
      }
      openAsForm(parsed);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <section className={`quick-entry${successPulse ? " is-success" : ""}`} aria-label="Nhập thu chi nhanh">
      <form className="quick-entry-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="quick-entry-field">
          <input
            className="quick-entry-input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="45k cafe · +5tr lương"
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            aria-invalid={!!error}
          />
          <button type="submit" className="btn btn-primary quick-entry-submit" disabled={saving || !value.trim()}>
            {saving ? "…" : "Lưu"}
          </button>
        </div>
        {error ? <p className="quick-entry-error">{error}</p> : null}
      </form>
    </section>
  );
}
