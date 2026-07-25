function toOccurredDateKey(value) {
  if (!value) return "";
  let date = null;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isFinanceTransactionType(type = "") {
  return ["expense", "income", "transfer", "adjustment"].includes(String(type || "").trim());
}

export function summarizeFinanceTotals(transactions = []) {
  const items = (Array.isArray(transactions) ? transactions : []).filter((transaction) =>
    isFinanceTransactionType(transaction?.type)
  );

  const incomeTotal = items
    .filter((item) => String(item?.type || "") === "income")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const expenseTotal = items
    .filter((item) => String(item?.type || "") === "expense")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const adjustmentTotal = items
    .filter((item) => String(item?.type || "") === "adjustment")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);

  return {
    incomeTotal,
    expenseTotal,
    adjustmentTotal,
    netTotal: incomeTotal - expenseTotal + adjustmentTotal,
  };
}

export function filterTransactionsByDateRange(transactions = [], fromDate = "", toDate = "") {
  const from = String(fromDate || "").trim();
  const to = String(toDate || "").trim();

  return (Array.isArray(transactions) ? transactions : []).filter((transaction) => {
    const dateKey = toOccurredDateKey(transaction?.occurredAt);
    if (!dateKey) return false;
    if (from && dateKey < from) return false;
    if (to && dateKey > to) return false;
    return true;
  });
}
