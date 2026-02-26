import {
  listExpensesByDateRange,
  listIncomesByDateRange,
  listTransfersByDateRange,
  listGoals,
  listHabits,
  listHabitLogsByRange,
  listVideoTasks,
  listWeeklyReviews,
} from "../../services/firebase/firestore.js";
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

function isValidMonthKey(value = "") {
  return /^\d{4}-\d{2}$/.test(String(value || "").trim());
}

function monthRangeFromKey(monthKey) {
  const key = String(monthKey || "").trim();
  if (!isValidMonthKey(key)) return null;
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const endExclusive = new Date(year, month, 1);
  endExclusive.setHours(0, 0, 0, 0);

  return {
    monthKey: `${yearRaw}-${monthRaw}`,
    start,
    endExclusive,
  };
}

function getCurrentMonthKey(now = new Date()) {
  const d = startOfDayLocal(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function resolveMonthRange(inputMonthKey, now = new Date()) {
  const currentMonthKey = getCurrentMonthKey(now);
  const resolved = monthRangeFromKey(inputMonthKey) || monthRangeFromKey(currentMonthKey);

  if (!resolved) {
    const fallback = monthRangeFromKey(currentMonthKey);
    return {
      monthKey: currentMonthKey,
      start: fallback?.start || startOfDayLocal(now),
      endExclusive: fallback?.endExclusive || new Date(startOfDayLocal(now).getTime() + 86400000),
      startKey: dateKeyLocal(fallback?.start || now),
      endKey: dateKeyLocal(new Date((fallback?.endExclusive?.getTime?.() || now.getTime()) - 86400000)),
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

function buildVideoSnapshot({ tasks, periodRange, now, deadlineWindowHours, periodMode = "week" }) {
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
    if (dueTime >= periodRange.start.getTime() && dueTime < periodRange.endExclusive.getTime()) {
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
    periodMode,
    deadlineWindowHours: hours,
    stageCounts,
  };
}

function buildReleasePlanSnapshot({ video = {}, goals = {}, finance = {} } = {}) {
  const stageCounts = video?.stageCounts || {};
  const stageRows = [
    { key: "idea", label: t("videoPlan.stage.idea", "Ý tưởng"), count: Number(stageCounts.idea || 0) },
    { key: "research", label: t("videoPlan.stage.research", "Nghiên cứu"), count: Number(stageCounts.research || 0) },
    { key: "script", label: t("videoPlan.stage.script", "Kịch bản"), count: Number(stageCounts.script || 0) },
    { key: "shoot", label: t("videoPlan.stage.shoot", "Quay"), count: Number(stageCounts.shoot || 0) },
    { key: "edit", label: t("videoPlan.stage.edit", "Dựng"), count: Number(stageCounts.edit || 0) },
    { key: "publish", label: t("videoPlan.stage.publish", "Xuất bản"), count: Number(stageCounts.publish || 0) },
  ];

  const actions = [];
  if (Number(video?.overdue || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.overdue", "Xử lý ngay {{count}} việc video quá hạn."), {
        count: Number(video?.overdue || 0),
      })
    );
  }
  if (Number(video?.dueInWeek || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.dueWeek", "Chốt timeline cho {{count}} việc có hạn trong tuần."), {
        count: Number(video?.dueInWeek || 0),
      })
    );
  }
  if (Number(video?.open || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.openVideo", "Ưu tiên đẩy {{count}} việc video đang mở tiến thêm ít nhất 1 bước."), {
        count: Number(video?.open || 0),
      })
    );
  }
  if (Number(goals?.activeGoals || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.activeGoals", "Gắn tiến độ video với {{count}} mục tiêu cá nhân đang chạy."), {
        count: Number(goals?.activeGoals || 0),
      })
    );
  }
  if (Number(finance?.net || 0) < 0) {
    actions.push(t("weeklyReview.release.actions.netNegative", "Rà soát chi phí sản xuất trước khi chốt lịch quay tuần mới."));
  }
  if (!actions.length) {
    actions.push(
      t("weeklyReview.release.actions.default", "Tuần này ổn định, tiếp tục theo lịch đăng và nâng chất lượng từng video.")
    );
  }

  return {
    stageRows,
    actions: actions.slice(0, 5),
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

function buildMonthLabel(monthRange) {
  const [year, month] = String(monthRange?.monthKey || "").split("-");
  const header = year && month ? `Tháng ${month}/${year}` : t("weeklyReview.header.fallbackWeek");
  return `${header} • ${toShortDate(monthRange.start)} - ${toShortDate(
    new Date(monthRange.endExclusive.getTime() - 86400000)
  )}`;
}

function resolvePeriodRange(mode = "week", periodKey = "", now = new Date()) {
  const safeMode = mode === "month" ? "month" : "week";

  if (safeMode === "month") {
    const range = resolveMonthRange(periodKey, now);
    return {
      mode: "month",
      periodKey: range.monthKey,
      weekKey: "",
      monthKey: range.monthKey,
      start: range.start,
      endExclusive: range.endExclusive,
      startKey: range.startKey,
      endKey: range.endKey,
      label: buildMonthLabel(range),
    };
  }

  const range = resolveWeekRange(periodKey, now);
  return {
    mode: "week",
    periodKey: range.weekKey,
    weekKey: range.weekKey,
    monthKey: getCurrentMonthKey(range.start),
    start: range.start,
    endExclusive: range.endExclusive,
    startKey: range.startKey,
    endKey: range.endKey,
    label: buildWeekLabel(range),
  };
}

function normalizeHistoryItem(item) {
  const weekKey = String(item?.weekKey || item?.id || "").trim();
  const updatedAt = timestampToDate(item?.updatedAt) || timestampToDate(item?.createdAt);
  return {
    weekKey,
    label: weekKey,
    updatedAt,
  };
}

export function getCurrentWeekKey(now = new Date()) {
  return isoWeekKeyFromDate(now);
}

export async function buildWeeklyReviewVM(uid, weekKey, options = {}) {
  const now = options?.now instanceof Date ? options.now : new Date();
  const periodMode = String(options?.periodMode || "week").trim() === "month" ? "month" : "week";
  const periodRange = resolvePeriodRange(periodMode, weekKey, now);
  const deadlineWindowHours = clampNumber(
    options?.deadlineWindowHours,
    12,
    336,
    DEFAULT_DEADLINE_WINDOW_HOURS
  );
  const historyLimit = clampNumber(options?.historyLimit, 1, 52, DEFAULT_HISTORY_LIMIT);

  const [
    expenses,
    incomes,
    transfers,
    goals,
    habits,
    weekHabitLogs,
    tasks,
    historyRaw,
  ] = await Promise.all([
    listExpensesByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listIncomesByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listTransfersByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listGoals(uid),
    listHabits(uid, { active: true }),
    listHabitLogsByRange(uid, periodRange.startKey, periodRange.endKey),
    listVideoTasks(uid),
    listWeeklyReviews(uid, historyLimit),
  ]);

  const snapshot = {
    finance: buildFinanceSnapshot({ expenses, incomes, transfers }),
    goals: buildGoalsSnapshot({ goals, habits, weekHabitLogs }),
    video: buildVideoSnapshot({ tasks, periodRange, now, deadlineWindowHours, periodMode }),
  };
  const releasePlan = buildReleasePlanSnapshot(snapshot);

  const history = (Array.isArray(historyRaw) ? historyRaw : [])
    .map((item) => normalizeHistoryItem(item))
    .filter((item) => item.weekKey);

  if (periodMode === "week" && !history.some((item) => item.weekKey === periodRange.weekKey)) {
    history.unshift({
      weekKey: periodRange.weekKey,
      label: periodRange.weekKey,
      updatedAt: null,
    });
  }

  return {
    weekKey: periodRange.weekKey,
    weekLabel: periodRange.label,
    range: {
      start: periodRange.start,
      endExclusive: periodRange.endExclusive,
      startKey: periodRange.startKey,
      endKey: periodRange.endKey,
    },
    period: {
      mode: periodRange.mode,
      key: periodRange.periodKey,
      weekKey: periodRange.weekKey,
      monthKey: periodRange.monthKey,
      label: periodRange.label,
    },
    snapshot,
    releasePlan,
    history: periodMode === "week" ? history.slice(0, historyLimit) : [],
    historyEnabled: periodMode === "week",
    options: {
      deadlineWindowHours,
    },
  };
}


