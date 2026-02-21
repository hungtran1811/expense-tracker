import {
  addVideoTask,
  listVideoTasks,
  moveVideoTaskStage,
  updateVideoTask as updateVideoTaskDoc,
  deleteVideoTask,
  awardXp,
} from "../../services/firebase/firestore.js";
import { VIDEO_STAGES } from "./videoPlan.ui.js";
import {
  asDate,
  parseDateKey,
  toDateKey,
  toYm,
  startOfDay,
  endOfDay,
  addDays,
  startOfWeekMonday,
  startOfMonth,
  toMonthLabelVi,
} from "../../shared/utils/date.js";

function stageIndex(stage) {
  return VIDEO_STAGES.indexOf(stage);
}

function normalizeAssetLinks(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function loadVideoTasks(uid) {
  if (!uid) return [];
  return listVideoTasks(uid, { status: "active" });
}

export async function createVideoTask(uid, payload) {
  return addVideoTask(uid, {
    title: payload.title,
    stage: payload.stage || "idea",
    priority: payload.priority || "medium",
    deadline: payload.deadline || null,
    scriptUrl: payload.scriptUrl || "",
    shotList: payload.shotList || "",
    assetLinks: normalizeAssetLinks(payload.assetLinks),
    publishChecklist: {
      titleDone: false,
      thumbnailDone: false,
      descriptionDone: false,
      tagsDone: false,
    },
    status: "active",
    note: payload.note || "",
  });
}

export async function updateVideoTaskDetails(uid, taskId, payload) {
  if (!uid || !taskId) throw new Error("Thiếu thông tin công việc video");

  const data = {
    title: payload.title,
    priority: payload.priority || "medium",
    deadline: payload.deadline || null,
    scriptUrl: payload.scriptUrl || "",
    shotList: payload.shotList || "",
    assetLinks: normalizeAssetLinks(payload.assetLinks),
    note: payload.note || "",
  };

  await updateVideoTaskDoc(uid, taskId, data);
  return true;
}

export async function moveTaskToStage(uid, task, nextStage) {
  const fromStage = task.stage || "idea";
  if (!VIDEO_STAGES.includes(nextStage) || nextStage === fromStage) return;

  await moveVideoTaskStage(uid, task.id, nextStage);

  const fromIdx = stageIndex(fromStage);
  const toIdx = stageIndex(nextStage);

  if (toIdx > fromIdx) {
    await awardXp(uid, {
      sourceType: "video",
      sourceId: task.id,
      action: "video_stage_up",
      points: 15,
      periodKey: `${task.id}_${nextStage}`,
    });
  }

  if (nextStage === "publish") {
    await awardXp(uid, {
      sourceType: "video",
      sourceId: task.id,
      action: "video_publish",
      points: 40,
      periodKey: task.id,
    });
  }
}

export async function removeVideoTask(uid, taskId) {
  return deleteVideoTask(uid, taskId);
}

function toCreatedAtMs(task = {}) {
  const value = task?.createdAt;
  if (!value) return 0;
  if (value?.seconds) return Number(value.seconds) * 1000;
  const d = asDate(value);
  return d ? d.getTime() : 0;
}

function toDeadlineDate(task = {}) {
  const raw = task?.deadline;
  if (!raw) return null;

  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return endOfDay(raw);
  }

  const parsed = asDate(raw);
  if (!parsed) return null;

  // Firestore date values in this app are day-level in most cases.
  const hasExplicitTime =
    parsed.getHours() !== 0 ||
    parsed.getMinutes() !== 0 ||
    parsed.getSeconds() !== 0 ||
    parsed.getMilliseconds() !== 0;

  return hasExplicitTime ? parsed : endOfDay(parsed);
}

function toPriorityRank(priority = "medium") {
  const map = { high: 3, medium: 2, low: 1 };
  return map[String(priority || "medium")] || 2;
}

function sortAgendaByUrgency(a, b) {
  if ((a?.isOverdue ? 1 : 0) !== (b?.isOverdue ? 1 : 0)) {
    return (b?.isOverdue ? 1 : 0) - (a?.isOverdue ? 1 : 0);
  }
  if ((a?.dueMs || 0) !== (b?.dueMs || 0)) return (a?.dueMs || 0) - (b?.dueMs || 0);
  if ((b?.priorityRank || 0) !== (a?.priorityRank || 0)) return (b?.priorityRank || 0) - (a?.priorityRank || 0);
  return String(a?.title || "").localeCompare(String(b?.title || ""), "vi");
}

export function buildVideoCalendarVM(tasks = [], selectedDate, now = new Date(), options = {}) {
  const safeNow = asDate(now) || new Date();
  const safeNowMs = safeNow.getTime();
  const todayStart = startOfDay(safeNow);
  const todayEnd = endOfDay(safeNow);
  const todayKey = toDateKey(safeNow);

  const deadlineWindowHoursRaw = Number(options?.deadlineWindowHours || 72);
  const deadlineWindowHours = Number.isFinite(deadlineWindowHoursRaw)
    ? Math.max(1, Math.floor(deadlineWindowHoursRaw))
    : 72;
  const deadlineHorizonMs = safeNowMs + deadlineWindowHours * 60 * 60 * 1000;

  const selectedDateParsed = parseDateKey(selectedDate) || asDate(selectedDate) || safeNow;
  const selectedDateKey = toDateKey(selectedDateParsed) || todayKey;
  const monthAnchor = options?.monthAnchor || toYm(selectedDateParsed) || toYm(safeNow);

  const monthAnchorDate = asDate(`${monthAnchor}-01`) || startOfMonth(safeNow);
  const monthStart = startOfMonth(monthAnchorDate);
  const monthEnd = endOfDay(new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 0));
  const monthLabel = toMonthLabelVi(monthAnchorDate);

  const safeTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && typeof task === "object")
    .map((task) => {
      const deadlineDate = toDeadlineDate(task);
      const dueMs = deadlineDate ? deadlineDate.getTime() : 0;
      const dueDateKey = deadlineDate ? toDateKey(deadlineDate) : "";
      const isOverdue = !!(deadlineDate && dueMs < safeNowMs);
      const isDueToday = !!(deadlineDate && dueDateKey === todayKey);
      const isDueSoon = !!(deadlineDate && dueMs >= safeNowMs && dueMs <= deadlineHorizonMs);

      return {
        ...task,
        deadlineDate,
        dueMs,
        dueDateKey,
        isOverdue,
        isDueToday,
        isDueSoon,
        priorityRank: toPriorityRank(task.priority),
      };
    });

  const unscheduled = safeTasks
    .filter((task) => !task.deadlineDate)
    .sort((a, b) => toCreatedAtMs(b) - toCreatedAtMs(a))
    .map((task) => ({
      id: task.id || "",
      title: task.title || "(Không tên)",
      stage: task.stage || "idea",
      priority: task.priority || "medium",
      note: task.note || "",
      createdAtMs: toCreatedAtMs(task),
    }));

  const scheduled = safeTasks.filter((task) => !!task.deadlineDate);
  const dayMap = new Map();
  scheduled.forEach((task) => {
    const key = task.dueDateKey || "";
    if (!key) return;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push(task);
  });

  const reminderSource = scheduled.filter((task) => task.status !== "done");
  const reminderCounts = reminderSource.reduce(
    (acc, task) => {
      if (task.isOverdue) acc.overdue += 1;
      else if (task.isDueToday) acc.dueToday += 1;
      else if (task.isDueSoon) acc.dueSoon += 1;
      return acc;
    },
    { overdue: 0, dueToday: 0, dueSoon: 0 }
  );

  const weekStart = startOfWeekMonday(selectedDateParsed);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);
    const list = dayMap.get(dateKey) || [];
    const overdueCount = list.filter((item) => item.isOverdue).length;

    return {
      dateKey,
      dayNumber: date.getDate(),
      weekDayShort: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      totalCount: list.length,
      overdueCount,
    };
  });

  const monthGridStart = startOfWeekMonday(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(monthGridStart, index);
    const dateKey = toDateKey(date);
    const list = dayMap.get(dateKey) || [];
    const overdueCount = list.filter((item) => item.isOverdue).length;

    return {
      dateKey,
      dayNumber: date.getDate(),
      isInMonth: date >= monthStart && date <= monthEnd,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      totalCount: list.length,
      overdueCount,
    };
  });

  const agendaItems = (dayMap.get(selectedDateKey) || [])
    .slice()
    .sort(sortAgendaByUrgency)
    .map((task) => ({
      id: task.id || "",
      title: task.title || "(Không tên)",
      stage: task.stage || "idea",
      priority: task.priority || "medium",
      note: task.note || "",
      dueDateKey: task.dueDateKey || "",
      isOverdue: !!task.isOverdue,
      isDueToday: !!task.isDueToday,
      isDueSoon: !!task.isDueSoon,
    }));

  const allSorted = reminderSource
    .slice()
    .sort(sortAgendaByUrgency)
    .map((task) => ({
      id: task.id || "",
      title: task.title || "(Không tên)",
      stage: task.stage || "idea",
      priority: task.priority || "medium",
      dueDateKey: task.dueDateKey || "",
      isOverdue: !!task.isOverdue,
      isDueToday: !!task.isDueToday,
      isDueSoon: !!task.isDueSoon,
    }));

  const reminderTopTask =
    allSorted.find((item) => item.isOverdue)?.id ||
    allSorted.find((item) => item.isDueToday)?.id ||
    allSorted.find((item) => item.isDueSoon)?.id ||
    "";

  return {
    monthAnchor,
    monthLabel,
    selectedDateKey,
    selectedDateLabel: selectedDateParsed.toLocaleDateString("vi-VN"),
    deadlineWindowHours,
    reminders: {
      ...reminderCounts,
      topTaskId: reminderTopTask,
    },
    weekDays,
    monthDays,
    agendaItems,
    unscheduled,
  };
}
