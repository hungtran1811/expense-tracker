import type { MoneyOwner } from "../lib/moneyOwner";

export type AccountType = "bank" | "wallet" | "cash" | "savings" | "other";
export type AccountStatus = "active" | "archived";
export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "adjustment"
  | "loan_lend"
  | "loan_repay";

export interface Account {
  id: string;
  name: string;
  type: AccountType | string;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  status: AccountStatus | string;
  /** Ví thuộc dòng tiền nào: personal (mặc định) hoặc mother (vd. VP Bank). */
  moneyOwner: "personal" | "mother";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Transaction {
  id: string;
  type: TransactionType | string;
  amount: number;
  occurredAt: unknown;
  accountId: string;
  toAccountId?: string;
  categoryKey?: string;
  scopeId?: string;
  loanPartyId?: string;
  interestRate?: number;
  moneyOwner: MoneyOwner;
  note?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExpenseScope {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface ExpenseCategory {
  id: string;
  key: string;
  name: string;
  legacyKey?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface ScopeBudget {
  id: string;
  scopeId: string;
  monthKey: string;
  limitAmount: number;
}

export interface LoanParty {
  id: string;
  name: string;
  note?: string;
}

export interface RecurringRule {
  id: string;
  type: string;
  amount: number;
  dayOfMonth: number;
  accountId: string;
  scopeId?: string;
  categoryKey?: string;
  note?: string;
  active: boolean;
  /** YYYY-MM of last auto-created transaction (idempotent monthly run). */
  lastGeneratedYm?: string;
}

export type SavingsGoalIconKey =
  | "house"
  | "car"
  | "phone"
  | "travel"
  | "education"
  | "wedding"
  | "emergency"
  | "custom";

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  note?: string;
  /** Visual category for goal posters (house/car/…). Legacy docs omit this. */
  iconKey?: SavingsGoalIconKey | string;
}
