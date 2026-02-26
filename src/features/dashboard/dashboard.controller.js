import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { PROFILE_VI } from "../../shared/constants/profile.vi.js";

const PERIOD_LABEL = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

const PERIOD_WEIGHT = {
  day: 3,
  week: 2,
  month: 1,
};

const VIDEO_STAGE_ORDER = {
  idea: 0,
  research: 1,
  script: 2,
  shoot: 3,
  edit: 4,
  publish: 5,
};

function greetingKeyByHour(hour = new Date().getHours()) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function normalizeGoals(goals = []) {
  return (Array.isArray(goals) ? goals : []).filter((goal) => {
    const target = Number(goal?.targetValue || 0);
    const current = Number(goal?.currentValue || 0);
    const done = goal?.status === "done" || (target > 0 && current >= target);
    return !done;
  });
}

function calcRemainingHabitTurns(habitProgress = {}) {
  return Object.values(habitProgress || {}).reduce((sum, item) => {
    const remaining = Number(item?.remaining ?? Math.max(0, Number(item?.target || 0) - Number(item?.done || 0)));
    return sum + Math.max(0, remaining);
  }, 0);
}

function calcOpenVideoTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => task?.status !== "done").length;
}

function parseTaskDeadline(task) {
  const raw = task?.deadline;
  if (!raw) return null;

  if (raw?.seconds) {
    const dt = new Date(raw.seconds * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

function normalizeAccountBalanceItem(item = {}) {
  const name = item?.accountName || item?.account || item?.name || "(Không rõ)";
  const balance = Number(item?.balance || 0);
  return {
    name,
    balance: Number.isFinite(balance) ? balance : 0,
  };
}

function parseClassNextDate(value) {
  if (!value) return null;
  if (value?.seconds) {
    const dt = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildUpcomingClassModule(classes = [], now = new Date()) {
  const safeNow = now instanceof Date ? now : new Date();
  const nowMs = safeNow.getTime();
  const list = (Array.isArray(classes) ? classes : [])
    .map((item) => {
      const nextDate = parseClassNextDate(item?.nextScheduledAt);
      const totalSessions = Math.max(1, Number(item?.totalSessions || 14));
      const remainingSessions = Math.max(
        0,
        Number(item?.remainingSessions ?? totalSessions - Number(item?.doneSessions || 0))
      );
      return {
        ...item,
        totalSessions,
        remainingSessions,
        nextDate,
      };
    })
    .filter((item) => String(item?.status || "active") === "active" && item.remainingSessions > 0)
    .filter((item) => item.nextDate instanceof Date && !Number.isNaN(item.nextDate.getTime()))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  const picked = list.find((item) => item.nextDate.getTime() >= nowMs) || list[0] || null;
  if (!picked) {
    return {
      hasUpcoming: false,
      title: t("dashboard.classes.title", "Buổi học sắp tới"),
      empty: t("dashboard.classes.empty", "Chưa có buổi học nào sắp tới."),
      open: t("dashboard.classes.open", "Mở lớp học"),
      classId: "",
      summary: "",
      detail: "",
    };
  }

  const dateLabel = toDateLabel(picked.nextDate);
  const timeLabel = picked.nextDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const sessionNo = Math.max(1, Number(picked?.nextSessionNo || 1));

  return {
    hasUpcoming: true,
    title: t("dashboard.classes.title", "Buổi học sắp tới"),
    empty: "",
    open: t("dashboard.classes.open", "Mở lớp học"),
    classId: String(picked?.id || ""),
    summary: `${picked?.code || ""} • ${picked?.title || ""}`.trim().replace(/^•\s*/, ""),
    detail: `${dateLabel} ${timeLabel} • Buổi ${sessionNo}/${picked.totalSessions} • Còn ${picked.remainingSessions} buổi`,
  };
}

function getHabitCandidates(state = {}) {
  const habits = Array.isArray(state.habits) ? state.habits : [];
  const habitProgress = state.habitProgress && typeof state.habitProgress === "object" ? state.habitProgress : {};

  return habits
    .map((habit) => {
      const progress = habitProgress[habit.id] || {};
      const target = Math.max(1, Number(progress.target || habit.targetCount || 1));
      const done = Math.max(0, Number(progress.done || 0));
      const remaining = Math.max(0, Number(progress.remaining ?? target - done));
      const period = habit?.period || "day";

      return {
        key: `habit-${habit.id}`,
        type: "habit",
        id: habit.id,
        title: habit.name || "(Không tên)",
        remaining,
        done,
        target,
        period,
        periodLabel: PERIOD_LABEL[period] || "Ngày",
        periodWeight: PERIOD_WEIGHT[period] || 0,
      };
    })
    .filter((item) => item.id && item.remaining > 0)
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      if (b.periodWeight !== a.periodWeight) return b.periodWeight - a.periodWeight;
      return String(a.title).localeCompare(String(b.title), "vi");
    });
}

function getVideoCandidates(state = {}) {
  return (Array.isArray(state.videoTasks) ? state.videoTasks : [])
    .filter((task) => task?.status !== "done")
    .map((task) => {
      const stage = String(task?.stage || "idea");
      const stageIndex = Number(VIDEO_STAGE_ORDER[stage] ?? 0);
      const stageLabel = t(`videoPlan.stage.${stage}`, "Ý tưởng");
      const deadline = parseTaskDeadline(task);

      return {
        key: `video-${task.id}`,
        type: "video",
        id: task.id,
        title: task?.title || "(Không tên)",
        stage,
        stageIndex,
        stageLabel,
        deadline,
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      return a.stageIndex - b.stageIndex;
    });
}

function scorePriorityItem(item, now) {
  if (item.type === "habit") {
    return 1000 + item.remaining * 10 + item.periodWeight;
  }

  if (item.deadline instanceof Date && !Number.isNaN(item.deadline.getTime())) {
    const hoursLeft = Math.max(0, (item.deadline.getTime() - now.getTime()) / 36e5);
    return 1500 - Math.min(720, hoursLeft);
  }

  return 500 - item.stageIndex;
}

function mapPriorityItem(item) {
  if (item.type === "habit") {
    return {
      key: item.key,
      type: item.type,
      id: item.id,
      title: item.title,
      meta: formatTemplate(t("dashboard.nextAction.habitMeta", "{{remaining}} lượt còn lại • {{period}}"), {
        remaining: item.remaining,
        period: item.periodLabel,
      }),
      badge: t("dashboard.nextAction.habitBadge", "Thói quen"),
      actionLabel: t("dashboard.nextAction.actionCheckIn", "Điểm danh"),
    };
  }

  const dueDate = toDateLabel(item.deadline);
  const meta = dueDate
    ? formatTemplate(t("dashboard.nextAction.videoMetaDue", "Hạn {{dueDate}} • {{stage}}"), {
        dueDate,
        stage: item.stageLabel,
      })
    : formatTemplate(t("dashboard.nextAction.videoMetaNoDue", "Chưa có hạn • {{stage}}"), {
        stage: item.stageLabel,
      });

  return {
    key: item.key,
    type: item.type,
    id: item.id,
    title: item.title,
    meta,
    badge: t("dashboard.nextAction.videoBadge", "Video"),
    actionLabel: dueDate
      ? t("dashboard.nextAction.actionOpenVideo", "Mở công việc")
      : t("dashboard.nextAction.actionOpenBoard", "Mở bảng"),
  };
}

function getDeadlineWindowItems(videoItems = [], now = new Date(), windowHours = 72) {
  const nowMs = now.getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const hours = Number.isFinite(Number(windowHours)) ? Math.max(1, Number(windowHours)) : 72;
  const horizonMs = nowMs + hours * 60 * 60 * 1000;

  const all = videoItems
    .filter((item) => item.deadline instanceof Date && !Number.isNaN(item.deadline.getTime()))
    .map((item) => {
      const dueMs = item.deadline.getTime();
      const reminderType =
        dueMs < nowMs ? "overdue" : dueMs >= todayStart && dueMs <= todayEnd ? "dueToday" : dueMs <= horizonMs ? "dueSoon" : "";
      return {
        ...item,
        dueMs,
        reminderType,
      };
    })
    .filter((item) => !!item.reminderType)
    .sort((a, b) => a.dueMs - b.dueMs);

  const counts = all.reduce(
    (acc, item) => {
      if (item.reminderType === "overdue") acc.overdue += 1;
      if (item.reminderType === "dueToday") acc.dueToday += 1;
      if (item.reminderType === "dueSoon") acc.dueSoon += 1;
      return acc;
    },
    { overdue: 0, dueToday: 0, dueSoon: 0 }
  );

  const items = all
    .map((item) => ({
      id: item.id,
      title: item.title,
      stage: item.stage,
      stageLabel: item.stageLabel,
      dueDate: toDateLabel(item.deadline),
      reminderType: item.reminderType,
    }))
    .slice(0, 4);

  return {
    items,
    counts,
  };
}

function resolveMissionText({ openVideoTasks, remainingHabitTurns }) {
  if (remainingHabitTurns > 0) {
    return formatTemplate(t("dashboard.hero.missionHabit", ""), {
      count: remainingHabitTurns,
    });
  }
  if (openVideoTasks > 0) {
    return formatTemplate(t("dashboard.hero.missionVideo", ""), {
      count: openVideoTasks,
    });
  }
  return PROFILE_VI.missionDefault || t("dashboard.hero.missionDefault", "");
}

export function buildDashboardPriorityVM(state = {}, now = new Date(), options = {}) {
  const maxItems = Math.max(1, Number(options?.maxItems || 3));
  const deadlineWindowHours = Number(options?.deadlineWindowHours || 72);
  const safeNow = now instanceof Date ? now : new Date();

  const habits = getHabitCandidates(state);
  const videos = getVideoCandidates(state);

  const merged = [...habits, ...videos]
    .map((item) => ({
      ...item,
      score: scorePriorityItem(item, safeNow),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.type === b.type) return String(a.title).localeCompare(String(b.title), "vi");
      return a.type === "habit" ? -1 : 1;
    })
    .slice(0, maxItems)
    .map((item) => mapPriorityItem(item));

  const topHabit = merged.find((item) => item.type === "habit");
  const reminder = getDeadlineWindowItems(videos, safeNow, deadlineWindowHours);

  return {
    items: merged,
    topHabitId: topHabit?.id || "",
    topDeadlineTaskId: reminder.items[0]?.id || "",
    habitRemainingTurns: calcRemainingHabitTurns(state.habitProgress),
    openVideoTasks: calcOpenVideoTasks(state.videoTasks),
  };
}

export function buildDashboardActionBoardVM(state = {}, now = new Date(), options = {}) {
  const maxItems = Math.max(1, Number(options?.maxItems || 3));
  const deadlineWindowHoursRaw = Number(options?.deadlineWindowHours || 72);
  const deadlineWindowHours = Number.isFinite(deadlineWindowHoursRaw)
    ? Math.max(12, Math.floor(deadlineWindowHoursRaw))
    : 72;

  const priority = buildDashboardPriorityVM(state, now, {
    maxItems,
    deadlineWindowHours,
  });
  const videos = getVideoCandidates(state);
  const reminder = getDeadlineWindowItems(videos, now, deadlineWindowHours);
  const deadlineItems = reminder.items;
  const reminderCounts = reminder.counts;

  const summaryText =
    priority.habitRemainingTurns > 0 || priority.openVideoTasks > 0
      ? formatTemplate(t("dashboard.actionBoard.summary", ""), {
          habitCount: priority.habitRemainingTurns,
          videoCount: priority.openVideoTasks,
        })
      : t("dashboard.actionBoard.summaryDone", "Hôm nay không có việc khẩn cấp.");

  return {
    title: t("dashboard.actionBoard.title", "Bảng hành động hôm nay"),
    subtitle: formatTemplate(
      t("dashboard.actionBoard.subtitle", "Tập trung vào việc kế tiếp và các công việc video cận hạn {{hours}} giờ."),
      { hours: deadlineWindowHours }
    ),
    nextTitle: t("dashboard.actionBoard.nextTitle", "Việc kế tiếp"),
    deadlineTitle: formatTemplate(t("dashboard.actionBoard.deadlineTitle", "Cận hạn {{hours}} giờ"), {
      hours: deadlineWindowHours,
    }),
    summaryTitle: t("dashboard.actionBoard.summaryTitle", "Tóm tắt hành động"),
    summaryText,
    deadlineWindowHours,
    reminders: reminderCounts,
    nextActions: priority.items,
    deadlineItems,
    quickActions: {
      habitId: priority.topHabitId || "",
      deadlineTaskId: deadlineItems[0]?.id || priority.topDeadlineTaskId || "",
    },
  };
}

export function buildDashboardHeroVM(state = {}, now = new Date()) {
  const hour = now instanceof Date ? now.getHours() : new Date().getHours();
  const greetingKey = greetingKeyByHour(hour);
  const name = PROFILE_VI.shortName || PROFILE_VI.displayName || "Hưng";

  const remainingHabitTurns = calcRemainingHabitTurns(state.habitProgress);
  const openVideoTasks = calcOpenVideoTasks(state.videoTasks);
  const activeGoals = normalizeGoals(state.goals).length;

  return {
    greeting: formatTemplate(t(`dashboard.hero.greeting.${greetingKey}`, "Xin chào, {{name}}"), {
      name,
    }),
    tagline: PROFILE_VI.tagline || t("brand.subtitle", ""),
    missionTitle: t("dashboard.hero.missionTitle", "Nhiệm vụ hôm nay"),
    missionText: resolveMissionText({ openVideoTasks, remainingHabitTurns }),
    quickActionsTitle: t("dashboard.hero.quickActionsTitle", "Hành động nhanh"),
    meta: t("dashboard.hero.meta", ""),
    kpis: {
      openVideoTasks,
      remainingHabitTurns,
      activeGoals,
    },
  };
}

export function buildDashboardModulesVM(state = {}, now = new Date()) {
  const goals = normalizeGoals(state.goals);
  const openVideoTasks = calcOpenVideoTasks(state.videoTasks);
  const accountBalances = (Array.isArray(state.accountBalances) ? state.accountBalances : [])
    .map((item) => normalizeAccountBalanceItem(item))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 4);

  return {
    video: {
      count: openVideoTasks,
      subtitle: t("dashboard.modules.video.subtitle", ""),
    },
    goals: {
      count: goals.length,
      subtitle: t("dashboard.modules.goals.subtitle", ""),
    },
    accounts: {
      title: t("dashboard.modules.accounts.title", "Số dư tài khoản"),
      empty: t("dashboard.modules.accounts.empty", "Chưa có dữ liệu số dư tài khoản."),
      items: accountBalances,
    },
    classes: buildUpcomingClassModule(state.classes, now),
  };
}

export function buildDashboardCommandCenterVM(state = {}, now = new Date()) {
  const maxItems = Math.max(1, Number(state?.settings?.preferences?.dashboard?.nextActionsMax || 3));
  const deadlineWindowHours = Number(state?.settings?.preferences?.dashboard?.deadlineWindowHours || 72);

  const priority = buildDashboardPriorityVM(state, now, {
    maxItems,
    deadlineWindowHours,
  });
  return {
    hero: buildDashboardHeroVM(state, now),
    modules: buildDashboardModulesVM(state, now),
    priorityItems: priority.items,
    actionBoard: buildDashboardActionBoardVM(state, now, {
      maxItems,
      deadlineWindowHours,
    }),
  };
}
