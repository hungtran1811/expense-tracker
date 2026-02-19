import { getMonthValue } from "../../shared/ui/core.js";
import { listExpensesByMonth, listIncomesByMonth } from "../../services/firebase/firestore.js";

export async function exportCsvCurrentMonth(uid) {
  const ym = getMonthValue();
  const [expenses, incomes] = await Promise.all([
    listExpensesByMonth(uid, ym),
    listIncomesByMonth(uid, ym),
  ]);

  const toISO = (d) => {
    const obj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return isNaN(obj) ? "" : obj.toISOString().slice(0, 10);
  };

  const rows = [
    ...expenses.map((x) => ({
      Type: "Expense",
      Date: toISO(x.date),
      Name: x.name || "",
      Amount: Number(x.amount || 0),
      Category: x.category || "",
      Account: x.account || "",
      Note: (x.note || "").replace(/\r?\n/g, " "),
    })),
    ...incomes.map((i) => ({
      Type: "Income",
      Date: toISO(i.date),
      Name: i.name || "",
      Amount: Number(i.amount || 0),
      Category: "",
      Account: i.account || "",
      Note: (i.note || "").replace(/\r?\n/g, " "),
    })),
  ].sort((a, b) => a.Date.localeCompare(b.Date));

  const header = ["Type", "Date", "Name", "Amount", "Category", "Account", "Note"];
  const csvBody = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.Type,
        r.Date,
        `"${r.Name.replace(/"/g, '""')}"`,
        r.Amount,
        `"${r.Category}"`,
        `"${r.Account}"`,
        `"${r.Note.replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvBody], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transactions_${ym}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
