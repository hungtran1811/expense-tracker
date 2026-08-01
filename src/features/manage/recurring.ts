import { createTransaction } from "../../services/firebase/firestore";
import { getTodayInputValue } from "../../shared/lib/date";
import { normalizeAccountMoneyOwner } from "../../shared/lib/moneyOwner";
import type { RecurringRule } from "../../shared/types/finance";

type AccountLike = { id: string; moneyOwner?: unknown };

export function buildTransactionFromRecurringRule(
  rule: Pick<
    RecurringRule,
    "type" | "amount" | "accountId" | "scopeId" | "categoryKey" | "note"
  >,
  accounts: AccountLike[] = [],
  occurredAt: string = getTodayInputValue()
) {
  const type = String(rule?.type || "expense").trim() === "income" ? "income" : "expense";
  const accountId = String(rule?.accountId || "").trim();
  const account = accounts.find((item) => item.id === accountId);
  const moneyOwner = normalizeAccountMoneyOwner(account?.moneyOwner);

  return {
    type,
    amount: Math.round(Number(rule?.amount || 0)),
    occurredAt: String(occurredAt || getTodayInputValue()).trim(),
    accountId,
    categoryKey: type === "expense" ? String(rule?.categoryKey || "other").trim() || "other" : "",
    scopeId: type === "expense" ? String(rule?.scopeId || "").trim() : "",
    note: String(rule?.note || "").trim(),
    moneyOwner,
  };
}

export async function createTransactionFromRecurringRule(
  uid: string,
  rule: Pick<
    RecurringRule,
    "type" | "amount" | "accountId" | "scopeId" | "categoryKey" | "note"
  >,
  accounts: AccountLike[] = [],
  options: { occurredAt?: string } = {}
) {
  const payload = buildTransactionFromRecurringRule(rule, accounts, options.occurredAt);
  return createTransaction(uid, payload);
}
