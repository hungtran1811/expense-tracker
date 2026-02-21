import {
  listHabits,
  listHabitLogsByRange,
} from "../../services/firebase/firestore.js";
import { buildDefaultMotivationSummary, calcProgress } from "./motivation.ui.js";

function dateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function dayRangeOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;

  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function sumByHabitIds(logs, habitIds) {
  const ids = habitIds instanceof Set ? habitIds : new Set();
  return (Array.isArray(logs) ? logs : [])
    .filter((log) => ids.has(log?.habitId))
    .reduce((sum, log) => sum + Number(log?.count || 0), 0);
}

async function computeMotivationSummary(uid) {
  if (!uid) return buildDefaultMotivationSummary();

  const now = new Date();
  const today = dateKey(now);
  const week = dayRangeOfWeek(now);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [rawHabits, rawDayLogs, rawWeekLogs, rawMonthLogs] = await Promise.all([
    listHabits(uid, { active: true }),
    listHabitLogsByRange(uid, today, today),
    listHabitLogsByRange(uid, dateKey(week.start), dateKey(week.end)),
    listHabitLogsByRange(uid, monthStart, today),
  ]);

  const habits = Array.isArray(rawHabits) ? rawHabits : [];
  const dayLogs = Array.isArray(rawDayLogs) ? rawDayLogs : [];
  const weekLogs = Array.isArray(rawWeekLogs) ? rawWeekLogs : [];
  const monthLogs = Array.isArray(rawMonthLogs) ? rawMonthLogs : [];

  const dailyHabits = habits.filter((h) => h.period === "day");
  const weeklyHabits = habits.filter((h) => h.period === "week");
  const monthlyHabits = habits.filter((h) => h.period === "month");

  const dailyHabitIds = new Set(dailyHabits.map((h) => h.id));
  const weeklyHabitIds = new Set(weeklyHabits.map((h) => h.id));
  const monthlyHabitIds = new Set(monthlyHabits.map((h) => h.id));

  const dayDone = sumByHabitIds(dayLogs, dailyHabitIds);
  const dayTarget = dailyHabits.reduce((sum, h) => sum + Number(h.targetCount || 1), 0);

  const weekDone = sumByHabitIds(weekLogs, weeklyHabitIds);
  const weekTarget = weeklyHabits.reduce((sum, h) => sum + Number(h.targetCount || 1), 0);

  const monthDone = sumByHabitIds(monthLogs, monthlyHabitIds);
  const monthTarget = monthlyHabits.reduce((sum, h) => sum + Number(h.targetCount || 1), 0);

  return {
    day: calcProgress(dayDone, dayTarget),
    week: calcProgress(weekDone, weekTarget),
    month: calcProgress(monthDone, monthTarget),
  };
}

export async function getMotivationSummary(uid) {
  return computeMotivationSummary(uid);
}

export async function getMotivationSummaryReadOnly(uid) {
  return computeMotivationSummary(uid);
}