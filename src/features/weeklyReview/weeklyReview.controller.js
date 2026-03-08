import {
  listExpensesByDateRange,
  listIncomesByDateRange,
  listTransfersByDateRange,
  listClassesOverview,
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

function buildClassesSnapshot({ classes = [] } = {}) {
  const safeClasses = Array.isArray(classes) ? classes : [];
  const activeClasses = safeClasses.filter((item) => String(item?.status || "active") !== "completed");
  const completedClasses = safeClasses.filter((item) => String(item?.status || "active") === "completed");

  const doneSessions = activeClasses.reduce((sum, item) => sum + Math.max(0, Number(item?.doneSessions || 0)), 0);
  const totalSessions = activeClasses.reduce(
    (sum, item) => sum + Math.max(1, Number(item?.totalSessions || 14)),
    0
  );
  const progressRate = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;

  return {
    activeClasses: activeClasses.length,
    completedClasses: completedClasses.length,
    doneSessions,
    totalSessions,
    progressRate,
  };
}

function buildTeachingSnapshot({ classes = [], periodRange, now, deadlineWindowHours }) {
  const safeClasses = Array.isArray(classes) ? classes : [];
  const safeNow = now instanceof Date ? now : new Date();
  const hours = clampNumber(deadlineWindowHours, 12, 336, DEFAULT_DEADLINE_WINDOW_HOURS);
  const horizon = new Date(safeNow.getTime() + hours * 60 * 60 * 1000);

  const activeClasses = safeClasses.filter((item) => String(item?.status || "active") !== "completed");
  let sessionsInPeriod = 0;
  let sessionsInWindow = 0;
  let overdueClasses = 0;

  activeClasses.forEach((item) => {
    const nextAt = timestampToDate(item?.nextScheduledAt);
    if (!nextAt) return;
    const nextMs = nextAt.getTime();
    if (nextMs >= periodRange.start.getTime() && nextMs < periodRange.endExclusive.getTime()) {
      sessionsInPeriod += 1;
    }
    if (nextMs >= safeNow.getTime() && nextMs <= horizon.getTime()) {
      sessionsInWindow += 1;
    }
    if (nextMs < safeNow.getTime()) {
      overdueClasses += 1;
    }
  });

  return {
    activeClasses: activeClasses.length,
    sessionsInPeriod,
    sessionsInWindow,
    overdueClasses,
    deadlineWindowHours: hours,
  };
}

function buildReleasePlanSnapshot({ teaching = {}, classes = {}, finance = {}, periodMode = "week" } = {}) {
  const actions = [];
  if (Number(teaching?.overdueClasses || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.overdueClasses", "Có {{count}} lớp quá lịch, mở lớp để cập nhật trạng thái buổi."), {
        count: Number(teaching?.overdueClasses || 0),
      })
    );
  }
  if (Number(teaching?.sessionsInPeriod || 0) > 0) {
    actions.push(
      formatTemplate(
        t(
          periodMode === "month"
            ? "weeklyReview.release.actions.sessionsInMonth"
            : "weeklyReview.release.actions.sessionsInWeek",
          periodMode === "month"
            ? "Có {{count}} lớp có buổi trong tháng, chuẩn bị tài liệu trước lịch dạy."
            : "Có {{count}} lớp có buổi trong tuần, chốt nội dung dạy và bài tập."
        ),
        {
          count: Number(teaching?.sessionsInPeriod || 0),
        }
      )
    );
  }
  if (Number(classes?.activeClasses || 0) > 0) {
    actions.push(
      formatTemplate(t("weeklyReview.release.actions.activeClasses", "Duy trì nhịp cập nhật cho {{count}} lớp đang dạy."), {
        count: Number(classes?.activeClasses || 0),
      })
    );
  }
  if (Number(finance?.net || 0) < 0) {
    actions.push(t("weeklyReview.release.actions.netNegative", "Rà soát chi phí tuần trước khi chốt lịch dạy tuần mới."));
  }
  if (!actions.length) {
    actions.push(
      t("weeklyReview.release.actions.default", "Tuần này ổn định, tiếp tục giữ lịch dạy đều và cập nhật ghi chú từng buổi.")
    );
  }

  return {
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
    classes,
    historyRaw,
  ] = await Promise.all([
    listExpensesByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listIncomesByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listTransfersByDateRange(uid, periodRange.start, periodRange.endExclusive),
    listClassesOverview(uid),
    listWeeklyReviews(uid, historyLimit),
  ]);

  const snapshot = {
    finance: buildFinanceSnapshot({ expenses, incomes, transfers }),
    classes: buildClassesSnapshot({ classes }),
    teaching: buildTeachingSnapshot({ classes, periodRange, now, deadlineWindowHours }),
  };
  const releasePlan = buildReleasePlanSnapshot({
    ...snapshot,
    periodMode,
  });

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


