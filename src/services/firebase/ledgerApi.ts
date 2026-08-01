/**
 * Typed thin wrappers around firestore ledger helpers (gradual escape from @ts-nocheck).
 */
import type { Account, RecurringRule, Transaction } from "../../shared/types/finance";
import * as raw from "./firestore";

export async function createLedgerTransaction(
  uid: string,
  payload: Partial<Transaction> & Record<string, unknown>
): Promise<{ id: string }> {
  return raw.createTransaction(uid, payload);
}

export async function updateLedgerTransaction(
  uid: string,
  id: string,
  payload: Partial<Transaction> & Record<string, unknown>
): Promise<boolean> {
  return raw.updateTransaction(uid, id, payload);
}

export async function deleteLedgerTransaction(uid: string, id: string): Promise<boolean> {
  return raw.deleteTransaction(uid, id);
}

export async function listLedgerAccounts(uid: string): Promise<Account[]> {
  return raw.listAccountsWithBalances(uid);
}

export async function updateRecurringRuleMeta(
  uid: string,
  id: string,
  payload: Partial<Pick<RecurringRule, "lastGeneratedYm" | "active" | "note" | "amount" | "dayOfMonth">>
): Promise<boolean> {
  return raw.updateRecurringRule(uid, id, payload);
}
