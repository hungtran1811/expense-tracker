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
  readWeeklyReview,
  saveWeeklyReview,
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

function isoWeekKeyFromDate(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekStartLocal(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
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

function toMs(value) {
  if (!value) return 0;
  if (typeof value?.seconds === "number") return Number(value.seconds) * 1000;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toDueMs(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = toMs(value);
  return ms > 0 ? ms : Number.POSITIVE_INFINITY;
}

function goalProgress(goal = {}) {
  const rawTarget = Number(goal?.targetValue || 0);
  const target = Math.max(1, normalizeTarget(goal?.targetValue));
  const current = Math.max(0, Number(goal?.currentValue || 0));
  const percent = Math.min(100, Math.round((current / target) * 100));
  const isDone = String(goal?.status || "").trim() === "done" || (rawTarget > 0 && current >= rawTarget);
  return { current, target, percent, isDone };
}

function normalizeTopPriorities(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeWeeklyGoalsPlan(input = {}) {
  const topPriorities = normalizeTopPriorities(
    input?.topPriorities || [input?.topPriority1, input?.topPriority2, input?.topPriority3]
  );

  return {
    focusTheme: String(input?.focusTheme || "").trim(),
    topPriorities,
    actionCommitments: String(input?.actionCommitments || "").trim(),
    riskNote: String(input?.riskNote || "").trim(),
  };
}

export function partitionGoals(goals = []) {
  const activeGoals = [];
  const completedGoals = [];

  (Array.isArray(goals) ? goals : []).forEach((goal) => {
    if (!goal || typeof goal !== "object") return;
    const progress = goalProgress(goal);
    if (progress.isDone) {
      completedGoals.push(goal);
      return;
    }
    activeGoals.push(goal);
  });

  return { activeGoals, completedGoals };
}

export function sortActiveGoals(goals = []) {
  return [...(Array.isArray(goals) ? goals : [])].sort((a, b) => {
    const dueDiff = toDueMs(a?.dueDate) - toDueMs(b?.dueDate);
    if (dueDiff !== 0) return dueDiff;

    const progressDiff = goalProgress(b).percent - goalProgress(a).percent;
    if (progressDiff !== 0) return progressDiff;

    const updatedDiff = toMs(b?.updatedAt) - toMs(a?.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;

    const createdDiff = toMs(b?.createdAt) - toMs(a?.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return String(a?.title || "").localeCompare(String(b?.title || ""), "vi");
  });
}

export function sortCompletedGoals(goals = []) {
  return [...(Array.isArray(goals) ? goals : [])].sort((a, b) => {
    const updatedDiff = toMs(b?.updatedAt) - toMs(a?.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;

    const createdDiff = toMs(b?.createdAt) - toMs(a?.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return String(a?.title || "").localeCompare(String(b?.title || ""), "vi");
  });
}

export function buildGoalsOverview(goals = [], now = new Date()) {
  const { activeGoals, completedGoals } = partitionGoals(goals);
  const nearCompleteCount = activeGoals.filter((goal) => goalProgress(goal).percent >= 80).length;
  const nowMs = toMs(now);
  const recentCompleted = completedGoals.some((goal) => {
    const updatedAtMs = Math.max(toMs(goal?.updatedAt), toMs(goal?.createdAt));
    return updatedAtMs > 0 && nowMs - updatedAtMs <= 3 * 24 * 60 * 60 * 1000;
  });

  let motivationLine = "Tiếp tục cập nhật đều để thấy tiến độ rõ ràng hơn.";
  if (!activeGoals.length) {
    motivationLine = "Chưa có mục tiêu đang chạy. Tạo một mục tiêu mới để bắt đầu.";
  } else if (nearCompleteCount > 0) {
    motivationLine = `Bạn đang rất gần đích ở ${nearCompleteCount} mục tiêu.`;
  } else if (recentCompleted) {
    motivationLine = "Bạn đang giữ được nhịp tiến độ.";
  }

  return {
    activeCount: activeGoals.length,
    completedCount: completedGoals.length,
    nearCompleteCount,
    motivationLine,
  };
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

export function getCurrentGoalsWeekKey(date = new Date()) {
  return isoWeekKeyFromDate(date);
}

export async function loadWeeklyGoalsPlan(uid, weekKey = "") {
  const targetWeekKey = String(weekKey || getCurrentGoalsWeekKey()).trim();
  if (!uid) {
    return {
      weekKey: targetWeekKey,
      plan: normalizeWeeklyGoalsPlan({}),
      updatedAt: null,
    };
  }

  const saved = await readWeeklyReview(uid, targetWeekKey);
  const savedPlan = saved?.plan || saved?.goalsPlan || {};

  return {
    weekKey: targetWeekKey,
    plan: normalizeWeeklyGoalsPlan(savedPlan),
    updatedAt: saved?.updatedAt || null,
  };
}

export async function saveWeeklyGoalsPlan(uid, weekKey, planInput = {}) {
  const targetWeekKey = String(weekKey || getCurrentGoalsWeekKey()).trim();
  if (!uid || !targetWeekKey) throw new Error("Thiếu thông tin để lưu mục tiêu tuần");

  const current = await readWeeklyReview(uid, targetWeekKey);
  const currentPlan = normalizeWeeklyGoalsPlan(current?.plan || {});
  const incomingPlan = normalizeWeeklyGoalsPlan(planInput);
  const plan = {
    focusTheme: incomingPlan.focusTheme || currentPlan.focusTheme || "",
    topPriorities: incomingPlan.topPriorities.length
      ? incomingPlan.topPriorities
      : currentPlan.topPriorities,
    actionCommitments: incomingPlan.actionCommitments || currentPlan.actionCommitments || "",
    riskNote: incomingPlan.riskNote || currentPlan.riskNote || "",
  };

  await saveWeeklyReview(uid, targetWeekKey, {
    weekKey: targetWeekKey,
    plan,
  });

  return {
    weekKey: targetWeekKey,
    plan,
    savedAt: new Date(),
  };
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
  const next = Math.max(0, Number(currentValue || 0));
  const target = Number(targetValue || 0);
  const status = next >= target && target > 0 ? "done" : "active";
  await updateGoal(uid, goalId, { currentValue: next, status });
}

export async function markGoalDone(uid, goalId) {
  await updateGoal(uid, goalId, { status: "done" });
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
