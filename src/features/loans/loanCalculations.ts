import type { Transaction } from "../../shared/types/finance";

export function getLoanInterestRate(transaction: Pick<Transaction, "interestRate"> | null | undefined): number {
  const rate = Number(transaction?.interestRate || 0);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function getLoanInterestAmount(
  transaction: Pick<Transaction, "type" | "amount" | "interestRate"> | null | undefined
): number {
  if (String(transaction?.type || "") !== "loan_lend") return 0;
  const principal = Math.abs(Number(transaction?.amount || 0));
  const rate = getLoanInterestRate(transaction);
  if (!(principal > 0) || !(rate > 0)) return 0;
  return (principal * rate) / 100;
}

/** Cho mượn: gốc + lãi. Nhận trả: đúng số đã nhận. */
export function getLoanReceivableAmount(
  transaction: Pick<Transaction, "type" | "amount" | "interestRate"> | null | undefined
): number {
  const principal = Math.abs(Number(transaction?.amount || 0));
  if (String(transaction?.type || "") !== "loan_lend") return principal;
  return principal + getLoanInterestAmount(transaction);
}

export function getPartyLoanStats(partyId: string, transactions: Transaction[] = []) {
  const id = String(partyId || "").trim();
  let lentPrincipal = 0;
  let receivable = 0;
  let repaid = 0;

  transactions.forEach((tx) => {
    if (String(tx.loanPartyId || "") !== id) return;
    if (tx.type === "loan_lend") {
      lentPrincipal += Math.abs(Number(tx.amount || 0));
      receivable += getLoanReceivableAmount(tx);
      return;
    }
    if (tx.type === "loan_repay") {
      repaid += Math.abs(Number(tx.amount || 0));
    }
  });

  return {
    lentPrincipal,
    receivable,
    repaid,
    outstanding: Math.max(0, receivable - repaid),
    interest: Math.max(0, receivable - lentPrincipal),
  };
}

export function buildOutstandingByParty(transactions: Transaction[] = [], partyIds: string[] = []) {
  const ids = partyIds.length
    ? partyIds
    : Array.from(new Set(transactions.map((tx) => String(tx.loanPartyId || "").trim()).filter(Boolean)));

  const map = new Map<string, ReturnType<typeof getPartyLoanStats>>();
  ids.forEach((id) => {
    map.set(id, getPartyLoanStats(id, transactions));
  });
  return map;
}

function toTimeMs(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as { toMillis?: () => number })?.toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Party still owes money and last lend was at least `minDays` ago. */
export function isLoanPartyNeedsReminder(
  partyId: string,
  transactions: Transaction[] = [],
  minDays = 30,
  nowMs = Date.now()
): boolean {
  const stats = getPartyLoanStats(partyId, transactions);
  if (!(stats.outstanding > 0)) return false;
  const lends = transactions.filter(
    (tx) => tx.type === "loan_lend" && String(tx.loanPartyId || "") === String(partyId || "")
  );
  if (!lends.length) return false;
  const lastLendMs = Math.max(...lends.map((tx) => toTimeMs(tx.occurredAt)));
  if (!(lastLendMs > 0)) return false;
  return nowMs - lastLendMs >= minDays * 86400000;
}
