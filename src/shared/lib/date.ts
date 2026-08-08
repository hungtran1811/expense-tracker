export function pad(number: number): string {
  return String(number).padStart(2, "0");
}

export function getTodayInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getCurrentYm(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function toDateInputValue(value: unknown): string {
  if (!value) return "";
  let date: Date | null = null;
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(String(value));
  }
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateLabel(value: unknown): string {
  const key = toDateInputValue(value);
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonthLabel(ym: string = ""): string {
  const raw = String(ym || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return raw || "—";
  const [y, m] = raw.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export function prevYm(ym: string = getCurrentYm()): string {
  const [y, m] = String(ym || getCurrentYm())
    .split("-")
    .map(Number);
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthStartEnd(ym: string = getCurrentYm()): { fromDate: string; toDate: string } {
  const normalized = /^\d{4}-\d{2}$/.test(ym) ? ym : getCurrentYm();
  const [y, m] = normalized.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    fromDate: `${normalized}-01`,
    toDate: `${normalized}-${pad(last)}`,
  };
}

export function getYmFromDateInput(dateKey = ""): string {
  const raw = String(dateKey || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.slice(0, 7) : "";
}

export function shiftDateInput(dateKey: string, days: number): string {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : getTodayInputValue();
  const [y, m, d] = key.split("-").map(Number);
  return getTodayInputValue(new Date(y, m - 1, d + days));
}

export function defaultDateForMonth(ym: string = getCurrentYm()): string {
  const today = getTodayInputValue();
  const monthKey = /^\d{4}-\d{2}$/.test(ym) ? ym : getCurrentYm();
  if (today.startsWith(monthKey)) return today;
  return monthStartEnd(monthKey).toDate;
}

/** ISO-ish sortable key for Firestore Timestamp / Date / string. */
export function toSortableDateKey(value: unknown): string {
  if (!value) return "";
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value || "");
}
