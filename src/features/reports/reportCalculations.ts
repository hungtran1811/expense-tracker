import { formatCurrency } from "../../shared/lib/money";
import {
  matchesMoneyOwnerFilter,
  normalizeAccountMoneyOwner,
  resolveTransactionMoneyOwner,
  type MoneyOwner,
} from "../../shared/lib/moneyOwner";
import { toDateInputValue } from "../../shared/lib/date";
import { getFinanceCategoryLabel, isFinanceTransactionType } from "../../shared/constants/finance";
import type { Account, ExpenseCategory, ExpenseScope, Transaction } from "../../shared/types/finance";

export interface ReportFilters {
  fromDate: string;
  toDate: string;
  accountId: string;
  moneyOwner: string;
  type: string;
  categoryKey: string;
  search: string;
}

export interface OwnerTotals {
  owner: MoneyOwner | "total";
  income: number;
  expense: number;
  net: number;
  transfer: number;
  transactionCount: number;
  /** null khi không có thu — không giả % (tránh hiện 100% khi thu = 0). */
  spendRatio: number | null;
  avgDailyExpense: number;
  topCategoryKey: string;
  topCategoryLabel: string;
  topCategoryAmount: number;
  largestExpenseAmount: number;
  largestExpenseNote: string;
}

function includesAccount(tx: Transaction, accountId: string) {
  const target = String(accountId || "all").trim() || "all";
  if (target === "all") return true;
  return tx.accountId === target || tx.toAccountId === target;
}

export function filterReportTransactions(
  transactions: Transaction[] = [],
  filters: ReportFilters,
  accounts: Account[] = []
) {
  const search = String(filters.search || "")
    .trim()
    .toLowerCase();
  return transactions.filter((tx) => {
    if (!isFinanceTransactionType(tx.type)) return false;
    if (!includesAccount(tx, filters.accountId)) return false;
    const owner = resolveTransactionMoneyOwner(tx, accounts);
    if (!matchesMoneyOwnerFilter(owner, filters.moneyOwner)) return false;
    if (filters.type !== "all" && tx.type !== filters.type) return false;
    if (filters.categoryKey !== "all" && tx.type === "expense" && tx.categoryKey !== filters.categoryKey) {
      return false;
    }
    if (search) {
      const hay = `${tx.note || ""} ${tx.categoryKey || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function dayCount(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function buildOwnerTotals(
  owner: MoneyOwner | "total",
  items: Transaction[],
  filters: ReportFilters,
  categories: ExpenseCategory[]
): OwnerTotals {
  let income = 0;
  let expense = 0;
  let transfer = 0;
  const categoryMap = new Map<string, number>();
  let largestExpenseAmount = 0;
  let largestExpenseNote = "";

  items.forEach((tx) => {
    const amount = Math.abs(Number(tx.amount || 0));
    if (tx.type === "income") income += amount;
    if (tx.type === "expense") {
      expense += amount;
      const key = String(tx.categoryKey || "other");
      categoryMap.set(key, (categoryMap.get(key) || 0) + amount);
      if (amount > largestExpenseAmount) {
        largestExpenseAmount = amount;
        largestExpenseNote = String(tx.note || getFinanceCategoryLabel(key, categories));
      }
    }
    if (tx.type === "transfer") transfer += amount;
  });

  let topCategoryKey = "";
  let topCategoryAmount = 0;
  categoryMap.forEach((value, key) => {
    if (value > topCategoryAmount) {
      topCategoryAmount = value;
      topCategoryKey = key;
    }
  });

  const days = dayCount(filters.fromDate, filters.toDate);
  return {
    owner,
    income,
    expense,
    net: income - expense,
    transfer,
    transactionCount: items.length,
    spendRatio: income > 0 ? (expense / income) * 100 : null,
    avgDailyExpense: expense / days,
    topCategoryKey,
    topCategoryLabel: topCategoryKey ? getFinanceCategoryLabel(topCategoryKey, categories) : "—",
    topCategoryAmount,
    largestExpenseAmount,
    largestExpenseNote,
  };
}

export function buildOwnerComparison(
  transactions: Transaction[],
  filters: ReportFilters,
  categories: ExpenseCategory[] = [],
  accounts: Account[] = []
) {
  const personal = transactions.filter((tx) => resolveTransactionMoneyOwner(tx, accounts) === "personal");
  const mother = transactions.filter((tx) => resolveTransactionMoneyOwner(tx, accounts) === "mother");
  const unassigned = transactions.filter((tx) => resolveTransactionMoneyOwner(tx, accounts) === "unassigned");
  const classified = [...personal, ...mother];

  const personalTotals = buildOwnerTotals("personal", personal, filters, categories);
  const motherTotals = buildOwnerTotals("mother", mother, filters, categories);
  const totalTotals = buildOwnerTotals("total", classified, filters, categories);

  const expenseTotal = personalTotals.expense + motherTotals.expense;
  return {
    personal: personalTotals,
    mother: motherTotals,
    total: totalTotals,
    unassignedCount: unassigned.length,
    contribution: {
      personalShare: expenseTotal > 0 ? (personalTotals.expense / expenseTotal) * 100 : 0,
      motherShare: expenseTotal > 0 ? (motherTotals.expense / expenseTotal) * 100 : 0,
    },
  };
}

export function buildCategoryComparison(
  transactions: Transaction[],
  categories: ExpenseCategory[] = [],
  accounts: Account[] = []
) {
  const map = new Map<string, { key: string; label: string; personal: number; mother: number }>();
  transactions.forEach((tx) => {
    if (tx.type !== "expense") return;
    const owner = resolveTransactionMoneyOwner(tx, accounts);
    if (owner !== "personal" && owner !== "mother") return;
    const key = String(tx.categoryKey || "other");
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getFinanceCategoryLabel(key, categories),
        personal: 0,
        mother: 0,
      });
    }
    const row = map.get(key)!;
    row[owner] += Math.abs(Number(tx.amount || 0));
  });
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      total: row.personal + row.mother,
      personalText: formatCurrency(row.personal),
      motherText: formatCurrency(row.mother),
    }))
    .sort((a, b) => b.total - a.total);
}

export function buildDailyOwnerFlow(
  transactions: Transaction[],
  fromDate: string,
  toDate: string,
  accounts: Account[] = []
) {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  const keys: string[] = [];
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const cursor = new Date(start);
    while (cursor <= end) {
      keys.push(toDateInputValue(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const buckets = new Map(
    keys.map((dateKey) => [
      dateKey,
      {
        dateKey,
        personalIncome: 0,
        personalExpense: 0,
        motherIncome: 0,
        motherExpense: 0,
      },
    ])
  );

  transactions.forEach((tx) => {
    const dateKey = toDateInputValue(tx.occurredAt);
    if (!buckets.has(dateKey)) return;
    const owner = resolveTransactionMoneyOwner(tx, accounts);
    if (owner !== "personal" && owner !== "mother") return;
    const amount = Math.abs(Number(tx.amount || 0));
    const bucket = buckets.get(dateKey)!;
    if (tx.type === "income") {
      if (owner === "personal") bucket.personalIncome += amount;
      else bucket.motherIncome += amount;
    }
    if (tx.type === "expense") {
      if (owner === "personal") bucket.personalExpense += amount;
      else bucket.motherExpense += amount;
    }
  });

  return Array.from(buckets.values());
}

export function buildAccountBalanceSnapshot(accounts: Account[], accountId = "all") {
  const active = accounts.filter((item) => String(item.status || "active") !== "archived");
  const visible =
    accountId === "all" ? active : active.filter((item) => item.id === accountId);
  const totalBalance = visible.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  return {
    totalBalance,
    totalBalanceText: formatCurrency(totalBalance),
    items: visible.map((item) => ({
      id: item.id,
      name: item.name,
      moneyOwner: normalizeAccountMoneyOwner(item.moneyOwner),
      balanceText: formatCurrency(item.currentBalance || 0),
    })),
  };
}

export function summarizeOwnerBoard(
  owner: "personal" | "mother",
  accounts: Account[] = [],
  transactions: Transaction[] = []
) {
  const ownerAccounts = accounts.filter(
    (item) =>
      String(item.status || "active") !== "archived" &&
      normalizeAccountMoneyOwner(item.moneyOwner) === owner
  );
  const balance = ownerAccounts.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const ownerTx = transactions.filter((tx) => resolveTransactionMoneyOwner(tx, accounts) === owner);
  const income = ownerTx
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const expense = ownerTx
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

  return {
    owner,
    accounts: ownerAccounts,
    balance,
    income,
    expense,
    net: income - expense,
    balanceText: formatCurrency(balance),
    incomeText: formatCurrency(income),
    expenseText: formatCurrency(expense),
    netText: formatCurrency(income - expense),
  };
}

export function formatOwnerTotals(row: OwnerTotals) {
  return {
    ...row,
    incomeText: formatCurrency(row.income),
    expenseText: formatCurrency(row.expense),
    netText: formatCurrency(row.net),
    avgDailyExpenseText: formatCurrency(row.avgDailyExpense),
    topCategoryAmountText: formatCurrency(row.topCategoryAmount),
    largestExpenseAmountText: formatCurrency(row.largestExpenseAmount),
    spendRatioText:
      row.spendRatio == null
        ? row.expense > 0
          ? "Không có thu"
          : "—"
        : `${row.spendRatio.toFixed(0)}%`,
    spendRatioTone:
      row.spendRatio == null ? (row.expense > 0 ? "warn" : "") : row.spendRatio > 100 ? "warn" : "ok",
  };
}

export function buildScopeLabel(tx: Transaction, scopes: ExpenseScope[] = []) {
  if (tx.type !== "expense") return "";
  return scopes.find((item) => item.id === tx.scopeId)?.name || "";
}
