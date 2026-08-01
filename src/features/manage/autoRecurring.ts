import { getCurrentYm, getTodayInputValue } from "../../shared/lib/date";
import type { Account, RecurringRule } from "../../shared/types/finance";
import { createTransactionFromRecurringRule } from "./recurring";
import { updateRecurringRule } from "../../services/firebase/firestore";

/** Create due recurring txs for the current month once (idempotent via lastGeneratedYm). */
export async function materializeDueRecurringRules(
  uid: string,
  rules: RecurringRule[] = [],
  accounts: Account[] = [],
  today = getTodayInputValue()
) {
  const ym = getCurrentYm();
  const day = Number(today.slice(8));
  const created: string[] = [];

  for (const rule of rules) {
    if (!rule?.active || !rule.id) continue;
    if (Number(rule.dayOfMonth || 0) > day) continue;
    if (String(rule.lastGeneratedYm || "") === ym) continue;
    try {
      await createTransactionFromRecurringRule(uid, rule, accounts, { occurredAt: today });
      await updateRecurringRule(uid, rule.id, { lastGeneratedYm: ym });
      created.push(rule.id);
    } catch (err) {
      console.warn("Recurring materialize failed", rule.id, err);
    }
  }

  return created;
}
