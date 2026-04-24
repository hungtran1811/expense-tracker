import { LOAN_TRANSACTION_TYPE_OPTIONS, getTransactionTypeLabel } from "../../shared/constants/finance.constants.js";
import {
  formatCurrency,
  formatDateLabel,
  getTodayInputValue,
  toDateInputValue,
} from "../finance/finance.controller.js";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortAccounts(items = []) {
  return [...items].sort((a, b) => {
    const archivedA = String(a?.status || "active") === "archived" ? 1 : 0;
    const archivedB = String(b?.status || "active") === "archived" ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    const defaultA = a?.isDefault ? -1 : 0;
    const defaultB = b?.isDefault ? -1 : 0;
    if (defaultA !== defaultB) return defaultA - defaultB;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function sortLoanParties(items = []) {
  return [...items].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi"));
}

function sortLoanTransactions(items = []) {
  return [...items].sort((a, b) => {
    const aa = toDate(a?.occurredAt)?.getTime() || 0;
    const bb = toDate(b?.occurredAt)?.getTime() || 0;
    if (bb !== aa) return bb - aa;
    const ua = toDate(a?.updatedAt)?.getTime() || 0;
    const ub = toDate(b?.updatedAt)?.getTime() || 0;
    return ub - ua;
  });
}

function isLoanTransactionType(type = "") {
  return ["loan_lend", "loan_repay"].includes(String(type || "").trim());
}

function buildAccountMap(accounts = []) {
  return new Map((Array.isArray(accounts) ? accounts : []).map((item) => [String(item?.id || "").trim(), item]));
}

function buildLoanPartyMap(parties = []) {
  return new Map((Array.isArray(parties) ? parties : []).map((item) => [String(item?.id || "").trim(), item]));
}

function groupLoanTimeline(items = [], accountMap) {
  const groups = new Map();

  items.forEach((transaction) => {
    const dateLabel = formatDateLabel(transaction?.occurredAt);
    if (!groups.has(dateLabel)) {
      groups.set(dateLabel, {
        dateLabel,
        items: [],
      });
    }

    const account = accountMap.get(String(transaction?.accountId || "").trim());
    const amount = Math.abs(Number(transaction?.amount || 0));
    groups.get(dateLabel).items.push({
      id: String(transaction?.id || "").trim(),
      type: String(transaction?.type || "").trim(),
      typeLabel: getTransactionTypeLabel(transaction?.type),
      amountText:
        String(transaction?.type || "").trim() === "loan_lend"
          ? `-${formatCurrency(amount)}`
          : `+${formatCurrency(amount)}`,
      amountClass: String(transaction?.type || "").trim() === "loan_lend" ? "expense" : "income",
      accountLabel: String(account?.name || "Không rõ").trim(),
      note: String(transaction?.note || "").trim(),
    });
  });

  return Array.from(groups.values());
}

function getLoanOutstandingAmount(partyId = "", transactions = [], excludeTransactionId = "") {
  const id = String(partyId || "").trim();
  const excludeId = String(excludeTransactionId || "").trim();
  return (Array.isArray(transactions) ? transactions : []).reduce((sum, transaction) => {
    if (!isLoanTransactionType(transaction?.type)) return sum;
    if (String(transaction?.loanPartyId || "").trim() !== id) return sum;
    if (excludeId && String(transaction?.id || "").trim() === excludeId) return sum;
    const amount = Math.abs(Number(transaction?.amount || 0));
    if (String(transaction?.type || "").trim() === "loan_lend") return sum + amount;
    return sum - amount;
  }, 0);
}

export function buildLoanPartyDraft(party = null) {
  return {
    id: String(party?.id || "").trim(),
    name: String(party?.name || "").trim(),
    note: String(party?.note || "").trim(),
  };
}

export function sanitizeLoanPartyDraft(payload = {}) {
  const id = String(payload?.id || "").trim();
  const name = String(payload?.name || "").trim();
  const note = String(payload?.note || "").trim();

  if (!name) throw new Error("Vui lòng nhập tên người mượn.");

  return { id, name, note };
}

export function buildLoanEntryDraft({
  accounts = [],
  parties = [],
  transaction = null,
  type = "loan_lend",
  presetPartyId = "",
} = {}) {
  const activeAccounts = sortAccounts(accounts).filter((item) => String(item?.status || "active") !== "archived");
  const orderedParties = sortLoanParties(parties);
  const defaultAccountId =
    String(activeAccounts.find((item) => item?.isDefault)?.id || "").trim() ||
    String(activeAccounts[0]?.id || "").trim();
  const defaultPartyId =
    String(presetPartyId || "").trim() || String(orderedParties[0]?.id || "").trim();

  if (transaction) {
    return {
      id: String(transaction?.id || "").trim(),
      type: String(transaction?.type || type || "loan_lend").trim(),
      loanPartyId: String(transaction?.loanPartyId || defaultPartyId).trim(),
      accountId: String(transaction?.accountId || defaultAccountId).trim(),
      amount: Number(transaction?.amount || 0),
      occurredAt: toDateInputValue(transaction?.occurredAt),
      note: String(transaction?.note || "").trim(),
    };
  }

  return {
    id: "",
    type: String(type || "loan_lend").trim(),
    loanPartyId: defaultPartyId,
    accountId: defaultAccountId,
    amount: "",
    occurredAt: getTodayInputValue(),
    note: "",
  };
}

export function sanitizeLoanEntryDraft(payload = {}) {
  const id = String(payload?.id || "").trim();
  const type = String(payload?.type || "loan_lend").trim();
  const loanPartyId = String(payload?.loanPartyId || "").trim();
  const accountId = String(payload?.accountId || "").trim();
  const occurredAt = String(payload?.occurredAt || "").trim();
  const amount = Number(payload?.amount || 0);
  const note = String(payload?.note || "").trim();

  if (!LOAN_TRANSACTION_TYPE_OPTIONS.some((item) => item.key === type)) {
    throw new Error("Loại giao dịch công nợ không hợp lệ.");
  }
  if (!loanPartyId) throw new Error("Vui lòng chọn người mượn.");
  if (!accountId) throw new Error("Vui lòng chọn tài khoản.");
  if (!occurredAt) throw new Error("Vui lòng chọn ngày ghi nhận.");
  if (!(amount > 0)) throw new Error("Số tiền phải lớn hơn 0.");

  return {
    id,
    type,
    loanPartyId,
    accountId,
    amount,
    occurredAt,
    note,
  };
}

export function buildLoanEntryContext({ draft = {}, parties = [], transactions = [] } = {}) {
  const partyId = String(draft?.loanPartyId || "").trim();
  const currentId = String(draft?.id || "").trim();
  if (!partyId) return { visible: false };

  const party = buildLoanPartyMap(parties).get(partyId);
  const outstandingBefore = getLoanOutstandingAmount(partyId, transactions, currentId);
  const amount = Math.abs(Number(draft?.amount || 0));
  const type = String(draft?.type || "").trim();
  const outstandingAfter =
    type === "loan_repay" ? outstandingBefore - amount : outstandingBefore + amount;
  const isOverpay = type === "loan_repay" && amount > outstandingBefore;

  return {
    visible: true,
    partyId,
    partyName: String(party?.name || "Người mượn").trim(),
    outstandingBefore,
    outstandingBeforeText: formatCurrency(outstandingBefore),
    outstandingAfter,
    outstandingAfterText: formatCurrency(Math.max(outstandingAfter, 0)),
    amountText: formatCurrency(amount),
    isOverpay,
    note:
      type === "loan_repay"
        ? isOverpay
          ? "Số tiền nhận trả đang lớn hơn số còn nợ hiện tại."
          : outstandingAfter > 0
            ? `Sau lần này vẫn còn nợ ${formatCurrency(outstandingAfter)}.`
            : "Sau lần này khoản nợ sẽ về 0."
        : `Sau lần này tổng còn nợ sẽ là ${formatCurrency(outstandingAfter)}.`,
  };
}

export function buildLoansVm({
  accounts = [],
  parties = [],
  transactions = [],
  selectedPartyId = "",
} = {}) {
  const accountMap = buildAccountMap(accounts);
  const orderedParties = sortLoanParties(parties);
  const loanTransactions = sortLoanTransactions(transactions).filter((transaction) =>
    isLoanTransactionType(transaction?.type)
  );
  const partyMap = buildLoanPartyMap(orderedParties);
  const partyStats = new Map(
    orderedParties.map((party) => [
      String(party?.id || "").trim(),
      {
        lendTotal: 0,
        repayTotal: 0,
        outstanding: 0,
        txCount: 0,
        lastActivityAt: null,
      },
    ])
  );

  loanTransactions.forEach((transaction) => {
    const partyId = String(transaction?.loanPartyId || "").trim();
    if (!partyId || !partyStats.has(partyId)) return;
    const stats = partyStats.get(partyId);
    const amount = Math.abs(Number(transaction?.amount || 0));
    if (String(transaction?.type || "").trim() === "loan_lend") {
      stats.lendTotal += amount;
      stats.outstanding += amount;
    } else {
      stats.repayTotal += amount;
      stats.outstanding -= amount;
    }
    stats.txCount += 1;
    const currentTime = toDate(transaction?.occurredAt)?.getTime() || 0;
    const previousTime = toDate(stats.lastActivityAt)?.getTime() || 0;
    if (currentTime >= previousTime) {
      stats.lastActivityAt = transaction?.occurredAt || null;
    }
  });

  const partyItems = orderedParties
    .map((party) => {
      const stats = partyStats.get(String(party?.id || "").trim()) || {};
      return {
        id: String(party?.id || "").trim(),
        name: String(party?.name || "").trim(),
        note: String(party?.note || "").trim(),
        lendTotal: Number(stats.lendTotal || 0),
        repayTotal: Number(stats.repayTotal || 0),
        outstanding: Math.max(0, Number(stats.outstanding || 0)),
        txCount: Number(stats.txCount || 0),
        lastActivityAt: stats.lastActivityAt || null,
        lendTotalText: formatCurrency(stats.lendTotal || 0),
        repayTotalText: formatCurrency(stats.repayTotal || 0),
        outstandingText: formatCurrency(Math.max(0, Number(stats.outstanding || 0))),
        lastActivityLabel: stats.lastActivityAt ? formatDateLabel(stats.lastActivityAt) : "Chưa có giao dịch",
        canDelete: Number(stats.txCount || 0) === 0,
      };
    })
    .sort((a, b) => {
      if (Number(b.outstanding || 0) !== Number(a.outstanding || 0)) {
        return Number(b.outstanding || 0) - Number(a.outstanding || 0);
      }
      const timeA = toDate(a.lastActivityAt)?.getTime() || 0;
      const timeB = toDate(b.lastActivityAt)?.getTime() || 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    });

  const normalizedSelectedPartyId =
    partyItems.find((item) => item.id === String(selectedPartyId || "").trim())?.id ||
    String(partyItems[0]?.id || "").trim();

  const selectedParty = partyItems.find((item) => item.id === normalizedSelectedPartyId) || null;
  const selectedTransactions = loanTransactions.filter(
    (transaction) => String(transaction?.loanPartyId || "").trim() === normalizedSelectedPartyId
  );

  const recentBoundary = new Date();
  recentBoundary.setDate(recentBoundary.getDate() - 29);
  recentBoundary.setHours(0, 0, 0, 0);

  const recentSummary = loanTransactions.reduce(
    (acc, transaction) => {
      const occurredAt = toDate(transaction?.occurredAt);
      if (!occurredAt || occurredAt < recentBoundary) return acc;
      const amount = Math.abs(Number(transaction?.amount || 0));
      if (String(transaction?.type || "").trim() === "loan_lend") acc.lent += amount;
      if (String(transaction?.type || "").trim() === "loan_repay") acc.repaid += amount;
      return acc;
    },
    { lent: 0, repaid: 0 }
  );

  return {
    summary: {
      totalOutstanding: partyItems.reduce((sum, item) => sum + Number(item.outstanding || 0), 0),
      activePartyCount: partyItems.filter((item) => Number(item.outstanding || 0) > 0).length,
      recentLentTotal: recentSummary.lent,
      recentRepaidTotal: recentSummary.repaid,
      totalOutstandingText: formatCurrency(partyItems.reduce((sum, item) => sum + Number(item.outstanding || 0), 0)),
      activePartyCountText: `${partyItems.filter((item) => Number(item.outstanding || 0) > 0).length} người`,
      recentLentTotalText: formatCurrency(recentSummary.lent),
      recentRepaidTotalText: formatCurrency(recentSummary.repaid),
    },
    parties: {
      items: partyItems,
      countText: `${partyItems.length} người`,
      emptyTitle: "Chưa có người mượn nào",
      emptyBody: "Thêm người mượn đầu tiên để bắt đầu theo dõi công nợ.",
    },
    selectedPartyId: normalizedSelectedPartyId,
    selectedParty,
    timeline: {
      groups: groupLoanTimeline(selectedTransactions, accountMap),
      countText: `${selectedTransactions.length} giao dịch`,
      emptyTitle: "Chưa có lịch sử công nợ",
      emptyBody: selectedParty
        ? "Người này chưa có giao dịch cho mượn hoặc trả lại."
        : "Chọn một người mượn để xem lịch sử công nợ.",
    },
    partyOptions: orderedParties.map((party) => ({
      value: party.id,
      label: party.name,
    })),
    accountOptions: sortAccounts(accounts)
      .filter((item) => String(item?.status || "active") !== "archived")
      .map((account) => ({
        value: account.id,
        label: account.name,
      })),
  };
}
