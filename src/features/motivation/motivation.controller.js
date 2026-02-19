import {
  listHabits,
  listHabitLogsByRange,
  listXpLogsByRange,
  awardXp,
} from "../../services/firebase/firestore.js";
import { buildDefaultMotivationSummary, calcProgress } from "./motivation.ui.js";

function dateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function calcStreak(dailyHabits, logMap) {
  if (!dailyHabits.length) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = dateKey(cursor);
    const pass = dailyHabits.every((habit) => {
      const count = logMap.get(`${habit.id}_${key}`) || 0;
      return count >= Number(habit.targetCount || 1);
    });

    if (!pass) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function sumByHabitIds(logs, habitIds) {
  const ids = habitIds instanceof Set ? habitIds : new Set();
  return (Array.isArray(logs) ? logs : [])
    .filter((log) => ids.has(log?.habitId))
    .reduce((sum, log) => sum + Number(log?.count || 0), 0);
}

export async function getMotivationSummary(uid) {
  if (!uid) return buildDefaultMotivationSummary();

  const now = new Date();
  const today = dateKey(now);
  const week = dayRangeOfWeek(now);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [rawHabits, rawDayLogs, rawWeekLogs, rawMonthLogs, rawXpLogs] = await Promise.all([
    listHabits(uid, { active: true }),
    listHabitLogsByRange(uid, today, today),
    listHabitLogsByRange(uid, dateKey(week.start), dateKey(week.end)),
    listHabitLogsByRange(uid, monthStart, today),
    listXpLogsByRange(uid),
  ]);

  const habits = Array.isArray(rawHabits) ? rawHabits : [];
  const dayLogs = Array.isArray(rawDayLogs) ? rawDayLogs : [];
  const weekLogs = Array.isArray(rawWeekLogs) ? rawWeekLogs : [];
  const monthLogs = Array.isArray(rawMonthLogs) ? rawMonthLogs : [];
  const xpLogs = Array.isArray(rawXpLogs) ? rawXpLogs : [];

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

  const totalXp = xpLogs.reduce((sum, item) => sum + Number(item.points || 0), 0);
  const level = Math.floor(totalXp / 250) + 1;

  const mapAllLogs = new Map(monthLogs.map((x) => [`${x.habitId}_${x.dateKey}`, Number(x.count || 0)]));
  const streak = calcStreak(dailyHabits, mapAllLogs);

  const dayProgress = calcProgress(dayDone, dayTarget);
  const weekProgress = calcProgress(weekDone, weekTarget);
  const monthProgress = calcProgress(monthDone, monthTarget);

  if (dayProgress.percent >= 100 && dayTarget > 0) {
    await awardXp(uid, {
      sourceType: "habit",
      sourceId: "global",
      action: "challenge_day",
      points: 20,
      periodKey: today,
    });
  }

  if (weekProgress.percent >= 100 && weekTarget > 0) {
    await awardXp(uid, {
      sourceType: "habit",
      sourceId: "global",
      action: "challenge_week",
      points: 80,
      periodKey: weekKey(now),
    });
  }

  if (monthProgress.percent >= 100 && monthTarget > 0) {
    await awardXp(uid, {
      sourceType: "habit",
      sourceId: "global",
      action: "challenge_month",
      points: 250,
      periodKey: monthKey(now),
    });
  }

  return {
    streak,
    totalXp,
    level,
    day: dayProgress,
    week: weekProgress,
    month: monthProgress,
  };
}
