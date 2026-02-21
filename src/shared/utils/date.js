import { getMonthValue, initMonthFilter, prevYm, YM, lastMonths } from "../ui/core.js";

export { getMonthValue, initMonthFilter, prevYm, YM, lastMonths };

function pad2(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const d = new Date(value.getTime());
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (value?.seconds) {
    const d = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateKey(dateKey) {
  const raw = String(dateKey || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toDateKey(value) {
  const d = asDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toYm(value) {
  const d = asDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function startOfDay(value) {
  const d = asDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(value) {
  const d = asDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(value, days = 0) {
  const d = asDate(value);
  if (!d) return null;
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + Number(days || 0));
  return out;
}

function startOfWeekMonday(value) {
  const dayStart = startOfDay(value);
  if (!dayStart) return null;
  const day = dayStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dayStart, offset);
}

function endOfWeekSunday(value) {
  const weekStart = startOfWeekMonday(value);
  if (!weekStart) return null;
  const end = addDays(weekStart, 6);
  return endOfDay(end);
}

function startOfMonth(value) {
  const d = asDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(value) {
  const d = asDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toMonthLabelVi(value) {
  const d = asDate(value);
  if (!d) return "";
  return `Tháng ${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDateLabelVi(value) {
  const d = asDate(value);
  if (!d) return "";
  return d.toLocaleDateString("vi-VN");
}

function isSameDay(a, b) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function isToday(value, now = new Date()) {
  return isSameDay(value, now);
}

function toInputDate(value) {
  const d = asDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export {
  asDate,
  parseDateKey,
  toDateKey,
  toYm,
  startOfDay,
  endOfDay,
  addDays,
  startOfWeekMonday,
  endOfWeekSunday,
  startOfMonth,
  endOfMonth,
  toMonthLabelVi,
  toDateLabelVi,
  isSameDay,
  isToday,
  toInputDate,
};
