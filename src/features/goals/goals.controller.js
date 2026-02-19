import {
  addGoal,
  listGoals,
  updateGoal,
  deleteGoal,
  addHabit,
  listHabits,
  deleteHabit,
  addHabitLog,
  listHabitLogsByRange,
  awardXp,
} from "../../services/firebase/firestore.js";

function toLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function normalizeTarget(value) {
  const n = Number(value || 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function weekStartLocal(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  d.setDate(d.getDate() - diff);
  return d;
}

function weekEndLocal(date = new Date()) {
  const start = weekStartLocal(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function monthStartLocal(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEndLocal(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sumHabitLogsInRange(logs, habitId, fromKey, toKey) {
  return (Array.isArray(logs) ? logs : [])
    .filter((log) => {
      const key = String(log?.dateKey || "");
      return log?.habitId === habitId && key >= fromKey && key <= toKey;
    })
    .reduce((sum, log) => sum + Number(log?.count || 0), 0);
}

function buildHabitProgressMap(habits, logs, date = new Date()) {
  const map = {};

  (Array.isArray(habits) ? habits : []).forEach((habit) => {
    const range = getHabitPeriodRange(habit?.period || "day", date);
    const target = normalizeTarget(habit?.targetCount);
    const done = sumHabitLogsInRange(logs, habit.id, range.fromKey, range.toKey);

    map[habit.id] = {
      done,
      target,
      remaining: Math.max(0, target - done),
      locked: done >= target,
      period: habit?.period || "day",
      fromKey: range.fromKey,
      toKey: range.toKey,
    };
  });

  return map;
}

export function todayKey(date = new Date()) {
  return toLocalDateKey(date);
}

export function startOfMonthKey(date = new Date()) {
  const now = date instanceof Date ? date : new Date(date);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function getHabitPeriodRange(period = "day", date = new Date()) {
  if (period === "week") {
    return {
      fromKey: toLocalDateKey(weekStartLocal(date)),
      toKey: toLocalDateKey(weekEndLocal(date)),
    };
  }

  if (period === "month") {
    return {
      fromKey: toLocalDateKey(monthStartLocal(date)),
      toKey: toLocalDateKey(monthEndLocal(date)),
    };
  }

  const key = toLocalDateKey(date);
  return { fromKey: key, toKey: key };
}

export async function loadGoalsData(uid) {
  const now = new Date();
  const today = todayKey(now);
  const monthStart = startOfMonthKey(now);
  const weekStart = getHabitPeriodRange("week", now).fromKey;
  const logsStart = weekStart < monthStart ? weekStart : monthStart;

  const [rawGoals, rawHabits, rawLogs] = await Promise.all([
    listGoals(uid),
    listHabits(uid, { active: true }),
    listHabitLogsByRange(uid, logsStart, today),
  ]);

  const goals = Array.isArray(rawGoals) ? rawGoals : [];
  const habits = Array.isArray(rawHabits) ? rawHabits : [];
  const safeLogs = Array.isArray(rawLogs) ? rawLogs : [];
  const habitProgress = buildHabitProgressMap(habits, safeLogs, now);
  const todayLogs = safeLogs.filter((log) => String(log?.dateKey || "") === today);

  return { goals, habits, todayLogs, logs: safeLogs, habitProgress };
}

export async function createGoal(uid, payload) {
  return addGoal(uid, payload);
}

export async function saveGoalProgress(uid, goalId, currentValue, targetValue) {
  const next = Number(currentValue || 0);
  const target = Number(targetValue || 0);
  const status = next >= target && target > 0 ? "done" : "active";
  await updateGoal(uid, goalId, { currentValue: next, status });

  if (status === "done") {
    await awardXp(uid, {
      sourceType: "goal",
      sourceId: goalId,
      action: "goal_done",
      points: 120,
      periodKey: goalId,
    });
  }
}

export async function markGoalDone(uid, goalId) {
  await updateGoal(uid, goalId, { status: "done" });
  await awardXp(uid, {
    sourceType: "goal",
    sourceId: goalId,
    action: "goal_done",
    points: 120,
    periodKey: goalId,
  });
}

export async function removeGoal(uid, goalId) {
  return deleteGoal(uid, goalId);
}

export async function createHabit(uid, payload) {
  return addHabit(uid, payload);
}

export async function removeHabit(uid, habitId) {
  return deleteHabit(uid, habitId);
}

export async function checkInHabit(uid, habit) {
  const habitId = String(habit?.id || "").trim();
  if (!habitId) throw new Error("Không tìm thấy thói quen");

  const now = new Date();
  const dateKey = todayKey(now);
  const period = habit?.period || "day";
  const target = normalizeTarget(habit?.targetCount);
  const range = getHabitPeriodRange(period, now);

  const periodLogs = await listHabitLogsByRange(uid, range.fromKey, range.toKey);
  const doneInPeriod = sumHabitLogsInRange(periodLogs, habitId, range.fromKey, range.toKey);

  if (doneInPeriod >= target) {
    return {
      status: "locked",
      period,
      doneInPeriod,
      target,
      fromKey: range.fromKey,
      toKey: range.toKey,
    };
  }

  await addHabitLog(uid, {
    habitId,
    dateKey,
    count: 1,
  });

  const nextDone = doneInPeriod + 1;

  await awardXp(uid, {
    sourceType: "habit",
    sourceId: habitId,
    action: "habit_checkin",
    points: Number(habit.xpPerCheckin || 10),
    periodKey: `${dateKey}_${nextDone}`,
  });

  return {
    status: "success",
    period,
    doneInPeriod: nextDone,
    target,
    reachedTarget: nextDone >= target,
    fromKey: range.fromKey,
    toKey: range.toKey,
  };
}
