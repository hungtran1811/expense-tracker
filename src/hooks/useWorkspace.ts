import { useCallback, useEffect, useState } from "react";
import {
  listAccountsWithBalances,
  listExpenseCategories,
  listExpenseScopes,
  listLoanParties,
  listLoanTransactions,
  listRecurringRules,
  listSavingsGoals,
  listScopeBudgets,
  listTransactions,
} from "../services/firebase/firestore";
import type {
  Account,
  ExpenseCategory,
  ExpenseScope,
  LoanParty,
  RecurringRule,
  SavingsGoal,
  ScopeBudget,
  Transaction,
} from "../shared/types/finance";
import { getCurrentYm } from "../shared/lib/date";

export function useWorkspace(uid: string | undefined, month = getCurrentYm()) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scopes, setScopes] = useState<ExpenseScope[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loanParties, setLoanParties] = useState<LoanParty[]>([]);
  const [loanTransactions, setLoanTransactions] = useState<Transaction[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [scopeBudgets, setScopeBudgets] = useState<ScopeBudget[]>([]);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError("");
    try {
      const [
        nextAccounts,
        nextTransactions,
        nextScopes,
        nextCategories,
        nextParties,
        nextLoanTx,
        nextRules,
        nextGoals,
        nextBudgets,
      ] = await Promise.all([
        listAccountsWithBalances(uid),
        listTransactions(uid, { month }),
        listExpenseScopes(uid),
        listExpenseCategories(uid),
        listLoanParties(uid),
        listLoanTransactions(uid),
        listRecurringRules(uid),
        listSavingsGoals(uid),
        listScopeBudgets(uid, month).catch(() => []),
      ]);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setScopes(nextScopes);
      setCategories(nextCategories);
      setLoanParties(nextParties);
      setLoanTransactions(nextLoanTx);
      setRecurringRules(nextRules);
      setSavingsGoals(nextGoals);
      setScopeBudgets(nextBudgets);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [uid, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    accounts,
    transactions,
    scopes,
    categories,
    loanParties,
    loanTransactions,
    recurringRules,
    savingsGoals,
    scopeBudgets,
    refresh,
    month,
  };
}
