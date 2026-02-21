import {
  listExpensesByDateRange,
  listIncomesByDateRange,
  listTransfersByDateRange,
  listGoals,
  listHabits,
  listHabitLogsByRange,
  listVideoTasks,
  listVideoRetrosByRange,
  listXpLogsByRange,
  readWeeklyReview,
  saveWeeklyReview,
  listWeeklyReviews,
} from "../../services/firebase/firestore.js";
import { getMotivationSummaryReadOnly } from "../motivation/motivation.controller.js";
import { formatTemplate, t } from "../../shared/constants/copy.vi.js";

const DEFAULT_HISTORY_LIMIT = 12;
const DEFAULT_DEADLINE_WINDOW_HOURS = 72;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function timestampToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value?.seconds) {
    const dt = new Date(value.seconds * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfDayLocal(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKeyLocal(date = new Date()) {
  const d = startOfDayLocal(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeekLocal(date = new Date()) {
  const d = startOfDayLocal(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeekExclusive(start) {
  const d = startOfDayLocal(start);
  d.setDate(d.getDate() + 7);
  return d;
}

function isoWeekKeyFromDate(date = new Date()) {
  const local = startOfDayLocal(date);
  const temp = new Date(local);
  const day = (temp.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - day + 3);

  const firstThursday = new Date(temp.getFullYear(), 0, 4);
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);

  const weekNo = 1 + Math.round((temp.getTime() - firstThursday.getTime()) / 604800000);
  return `${temp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekRangeFromKey(weekKey) {
  const match = String(weekKey || "").trim().match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const mondayWeek1 = new Date(year, 0, 4 - jan4Day);
  mondayWeek1.setHours(0, 0, 0, 0);

  const start = new Date(mondayWeek1);
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  const endExclusive = endOfWeekExclusive(start);

  return {
    weekKey: `${year}-W${String(week).padStart(2, "0")}`,
    start,
    endExclusive,
  };
}

function resolveWeekRange(inputWeekKey, now = new Date()) {
  const currentWeekKey = isoWeekKeyFromDate(now);
  const resolved = weekRangeFromKey(inputWeekKey) || weekRangeFromKey(currentWeekKey);

  if (!resolved) {
    const fallbackStart = startOfWeekLocal(now);
    return {
      weekKey: currentWeekKey,
      start: fallbackStart,
      endExclusive: endOfWeekExclusive(fallbackStart),
      startKey: dateKeyLocal(fallbackStart),
      endKey: dateKeyLocal(new Date(endOfWeekExclusive(fallbackStart).getTime() - 86400000)),
    };
  }

  return {
    ...resolved,
    startKey: dateKeyLocal(resolved.start),
    endKey: dateKeyLocal(new Date(resolved.endExclusive.getTime() - 86400000)),
  };
}

function sumAmount(list = []) {
  return (Array.isArray(list) ? list : []).reduce((sum, item) => sum + Number(item?.amount || 0), 0);
}

function normalizeTopPriorities(input) {
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeWeeklyPlan(plan = {}) {
  const topPriorities = normalizeTopPriorities(plan.topPriorities || [
    plan.topPriority1,
    plan.topPriority2,
    plan.topPriority3,
  ]);

  return {
    focusTheme: String(plan.focusTheme || "").trim(),
    topPriorities,
    riskNote: String(plan.riskNote || "").trim(),
    actionCommitments: String(plan.actionCommitments || "").trim(),
  };
}

function parseTaskDeadline(task) {
  return timestampToDate(task?.deadline);
}

function buildFinanceSnapshot({ expenses, incomes, transfers }) {
  const totalExpense = sumAmount(expenses);
  const totalIncome = sumAmount(incomes);
  const totalTransfer = sumAmount(transfers);
  const net = totalIncome - totalExpense;

  return {
    totalExpense,
    totalIncome,
    totalTransfer,
    net,
    expenseCount: Array.isArray(expenses) ? expenses.length : 0,
    incomeCount: Array.isArray(incomes) ? incomes.length : 0,
    transferCount: Array.isArray(transfers) ? transfers.length : 0,
  };
}

function buildGoalsSnapshot({ goals, habits, weekHabitLogs }) {
  const safeGoals = Array.isArray(goals) ? goals : [];
  const safeHabits = Array.isArray(habits) ? habits : [];
  const safeLogs = Array.isArray(weekHabitLogs) ? weekHabitLogs : [];

  const doneGoals = safeGoals.filter((goal) => {
    const target = Number(goal?.targetValue || 0);
    const current = Number(goal?.currentValue || 0);
    return goal?.status === "done" || (target > 0 && current >= target);
  });

  const activeGoals = safeGoals.length - doneGoals.length;
  const habitLogMap = new Map();
  safeLogs.forEach((log) => {
    const key = String(log?.habitId || "").trim();
    if (!key) return;
    const prev = Number(habitLogMap.get(key) || 0);
    habitLogMap.set(key, prev + Number(log?.count || 0));
  });
  const habitsReached = safeHabits.filter((habit) => {
    const done = Number(habitLogMap.get(String(habit.id || "")) || 0);
    const target = Math.max(1, Number(habit?.targetCount || 1));
    return done >= target;
  }).length;

  const checkins = safeLogs.reduce((sum, log) => sum + Number(log?.count || 0), 0);
  const completionRate = safeHabits.length ? Math.round((habitsReached / safeHabits.length) * 100) : 0;

  return {
    activeGoals,
    doneGoals: doneGoals.length,
    habitsTotal: safeHabits.length,
    habitsReached,
    checkins,
    completionRate,
  };
}

function buildVideoSnapshot({ tasks, weekRange, now, deadlineWindowHours }) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeNow = now instanceof Date ? now : new Date();
  const hours = clampNumber(deadlineWindowHours, 12, 336, DEFAULT_DEADLINE_WINDOW_HOURS);
  const horizon = new Date(safeNow.getTime() + hours * 60 * 60 * 1000);

  const openTasks = safeTasks.filter((task) => task?.status !== "done");
  const doneTasks = safeTasks.length - openTasks.length;

  let dueInWeek = 0;
  let dueInWindow = 0;
  let overdue = 0;

  openTasks.forEach((task) => {
    const deadline = parseTaskDeadline(task);
    if (!deadline) return;

    const dueTime = deadline.getTime();
    if (dueTime >= weekRange.start.getTime() && dueTime < weekRange.endExclusive.getTime()) {
      dueInWeek += 1;
    }
    if (dueTime >= safeNow.getTime() && dueTime <= horizon.getTime()) {
      dueInWindow += 1;
    }
    if (dueTime < safeNow.getTime()) {
      overdue += 1;
    }
  });

  const stageCounts = {
    idea: 0,
    research: 0,
    script: 0,
    shoot: 0,
    edit: 0,
    publish: 0,
  };

  openTasks.forEach((task) => {
    const stage = String(task?.stage || "idea");
    if (!Object.prototype.hasOwnProperty.call(stageCounts, stage)) return;
    stageCounts[stage] += 1;
  });

  return {
    total: safeTasks.length,
    open: openTasks.length,
    done: doneTasks,
    dueInWeek,
    dueInWindow,
    overdue,
    deadlineWindowHours: hours,
    stageCounts,
  };
}

function buildVideoPerformanceSnapshot(videoRetros = []) {
  const safe = Array.isArray(videoRetros) ? videoRetros : [];
  const videosPublished = safe.length;

  if (!videosPublished) {
    return {
      videosPublished: 0,
      totalViews: 0,
      avgCtr: 0,
      avgRetention30s: 0,
      avgDurationSec: 0,
    };
  }

  const totalViews = safe.reduce((sum, item) => sum + Math.max(0, Number(item?.views || 0)), 0);
  const totalCtr = safe.reduce((sum, item) => sum + Math.max(0, Number(item?.ctr || 0)), 0);
  const totalRetention = safe.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.retention30s || 0)),
    0
  );
  const totalDuration = safe.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.durationSec || 0)),
    0
  );

  return {
    videosPublished,
    totalViews,
    avgCtr: Number((totalCtr / videosPublished).toFixed(2)),
    avgRetention30s: Number((totalRetention / videosPublished).toFixed(2)),
    avgDurationSec: Number((totalDuration / videosPublished).toFixed(2)),
  };
}

export function buildWeeklyLocalInsight(vm = {}) {
  const perf = vm?.snapshot?.videoPerformance || {};
  const lines = [];

  if (Number(perf?.videosPublished || 0) < 2) {
    lines.push(t("weeklyReview.videoPerformance.lowPublish"));
  }
  if (Number(perf?.avgCtr || 0) > 0 && Number(perf?.avgCtr || 0) < 4) {
    lines.push(t("weeklyReview.videoPerformance.lowCtr"));
  }
  if (
    Number(perf?.avgRetention30s || 0) > 0 &&
    Number(perf?.avgRetention30s || 0) < 45
  ) {
    lines.push(t("weeklyReview.videoPerformance.lowRetention"));
  }

  if (!lines.length) {
    lines.push(t("weeklyReview.videoPerformance.healthy"));
  }

  return lines;
}

function buildMotivationSnapshot({ summary, weekXpLogs }) {
  const safeSummary = summary || {};
  const safeWeekXpLogs = Array.isArray(weekXpLogs) ? weekXpLogs : [];
  const weekXp = safeWeekXpLogs.reduce((sum, item) => sum + Number(item?.points || 0), 0);

  return {
    streak: Number(safeSummary?.streak || 0),
    totalXp: Number(safeSummary?.totalXp || 0),
    level: Number(safeSummary?.level || 1),
    weekXp,
    weekXpActions: safeWeekXpLogs.length,
    dayProgress: safeSummary?.day || { done: 0, target: 0, percent: 0 },
    weekProgress: safeSummary?.week || { done: 0, target: 0, percent: 0 },
    monthProgress: safeSummary?.month || { done: 0, target: 0, percent: 0 },
  };
}

function toShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--/--";
  return date.toLocaleDateString("vi-VN");
}

function buildWeekLabel(weekRange) {
  return formatTemplate(t("weeklyReview.header.weekLabel"), {
    weekKey: weekRange.weekKey,
    range: `${toShortDate(weekRange.start)} - ${toShortDate(
      new Date(weekRange.endExclusive.getTime() - 86400000)
    )}`,
  });
}

function normalizeHistoryItem(item) {
  const weekKey = String(item?.weekKey || item?.id || "").trim();
  const updatedAt = timestampToDate(item?.updatedAt) || timestampToDate(item?.createdAt);
  return {
    weekKey,
    label: weekKey,
    updatedAt,
    hasPlan: !!String(item?.plan?.focusTheme || "").trim(),
  };
}

export function getCurrentWeekKey(now = new Date()) {
  return isoWeekKeyFromDate(now);
}

export async function buildWeeklyReviewVM(uid, weekKey, options = {}) {
  const now = options?.now instanceof Date ? options.now : new Date();
  const weekRange = resolveWeekRange(weekKey, now);
  const deadlineWindowHours = clampNumber(
    options?.deadlineWindowHours,
    12,
    336,
    DEFAULT_DEADLINE_WINDOW_HOURS
  );
  const historyLimit = clampNumber(options?.historyLimit, 1, 52, DEFAULT_HISTORY_LIMIT);
  const weekEndInclusive = new Date(weekRange.endExclusive.getTime() - 1);

  const [
    expenses,
    incomes,
    transfers,
    goals,
    habits,
    weekHabitLogs,
    tasks,
    videoRetros,
    motivationSummary,
    weekXpLogs,
    savedReview,
    historyRaw,
  ] = await Promise.all([
    listExpensesByDateRange(uid, weekRange.start, weekRange.endExclusive),
    listIncomesByDateRange(uid, weekRange.start, weekRange.endExclusive),
    listTransfersByDateRange(uid, weekRange.start, weekRange.endExclusive),
    listGoals(uid),
    listHabits(uid, { active: true }),
    listHabitLogsByRange(uid, weekRange.startKey, weekRange.endKey),
    listVideoTasks(uid),
    listVideoRetrosByRange(uid, weekRange.start, weekRange.endExclusive),
    getMotivationSummaryReadOnly(uid),
    listXpLogsByRange(uid, weekRange.start, weekEndInclusive),
    readWeeklyReview(uid, weekRange.weekKey),
    listWeeklyReviews(uid, historyLimit),
  ]);

  const snapshot = {
    finance: buildFinanceSnapshot({ expenses, incomes, transfers }),
    goals: buildGoalsSnapshot({ goals, habits, weekHabitLogs }),
    video: buildVideoSnapshot({ tasks, weekRange, now, deadlineWindowHours }),
    videoPerformance: buildVideoPerformanceSnapshot(videoRetros),
    motivation: buildMotivationSnapshot({ summary: motivationSummary, weekXpLogs }),
  };

  const storedPlan = normalizeWeeklyPlan(savedReview?.plan || {});

  const history = (Array.isArray(historyRaw) ? historyRaw : [])
    .map((item) => normalizeHistoryItem(item))
    .filter((item) => item.weekKey);

  if (!history.some((item) => item.weekKey === weekRange.weekKey)) {
    history.unshift({
      weekKey: weekRange.weekKey,
      label: weekRange.weekKey,
      updatedAt: null,
      hasPlan: !!storedPlan.focusTheme,
    });
  }

  return {
    weekKey: weekRange.weekKey,
    weekLabel: buildWeekLabel(weekRange),
    range: {
      start: weekRange.start,
      endExclusive: weekRange.endExclusive,
      startKey: weekRange.startKey,
      endKey: weekRange.endKey,
    },
    snapshot,
    localInsight: buildWeeklyLocalInsight({ snapshot }),
    plan: storedPlan,
    history: history.slice(0, historyLimit),
    options: {
      deadlineWindowHours,
    },
  };
}

function createReviewPayload(vm, plan) {
  return {
    weekKey: vm.weekKey,
    rangeStart: vm?.range?.startKey || "",
    rangeEnd: vm?.range?.endKey || "",
    snapshot: vm.snapshot || {},
    plan,
    finalizedAt: new Date(),
  };
}

export async function saveWeeklyReviewPlan(uid, vm, planInput = {}) {
  if (!uid) throw new Error("Thiếu thông tin người dùng");
  if (!vm?.weekKey) throw new Error("Thiếu tuần cần lưu");

  const normalizedPlan = normalizeWeeklyPlan(planInput);
  const payload = createReviewPayload(vm, normalizedPlan);

  await saveWeeklyReview(uid, vm.weekKey, payload);
  return normalizedPlan;
}

export function parseWeeklyPlanInput(formValues = {}) {
  return normalizeWeeklyPlan(formValues);
}

