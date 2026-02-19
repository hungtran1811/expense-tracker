import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { PROFILE_VI } from "../../shared/constants/profile.vi.js";

const PERIOD_LABEL = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
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

function buildPriorityItems(state = {}) {
  const habits = Array.isArray(state.habits) ? state.habits : [];
  const habitProgress = state.habitProgress && typeof state.habitProgress === "object" ? state.habitProgress : {};

  const habitItems = habits
    .map((habit) => {
      const progress = habitProgress[habit.id] || {};
      const target = Math.max(1, Number(progress.target || habit.targetCount || 1));
      const done = Math.max(0, Number(progress.done || 0));
      const remaining = Math.max(0, Number(progress.remaining ?? target - done));
      return {
        key: `habit-${habit.id}`,
        type: "habit",
        id: habit.id,
        title: habit.name || "(Không tên)",
        remaining,
        done,
        target,
        period: PERIOD_LABEL[habit.period] || "Ngày",
      };
    })
    .filter((item) => item.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 2)
    .map((item) => ({
      key: item.key,
      type: item.type,
      id: item.id,
      title: item.title,
      meta: formatTemplate(t("dashboard.priority.habitMeta", ""), {
        done: item.done,
        target: item.target,
        period: item.period,
      }),
      actionLabel: t("dashboard.priority.actionCheckIn", "Điểm danh"),
    }));

  const videoItems = (Array.isArray(state.videoTasks) ? state.videoTasks : [])
    .filter((task) => task?.status !== "done")
    .map((task) => {
      const stage = String(task?.stage || "idea");
      const stageLabel = t(`videoPlan.stage.${stage}`, "Ý tưởng");
      const deadline = parseTaskDeadline(task);
      const dueDate = toDateLabel(deadline);

      return {
        key: `video-${task.id}`,
        type: "video",
        id: task.id,
        title: task?.title || "(Không tên)",
        deadline,
        meta: dueDate
          ? formatTemplate(t("dashboard.priority.videoMetaDue", ""), { dueDate, stage: stageLabel })
          : formatTemplate(t("dashboard.priority.videoMetaNoDue", ""), { stage: stageLabel }),
        actionLabel: t("dashboard.priority.actionOpenVideo", "Mở bảng video"),
      };
    })
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    })
    .slice(0, 1);

  return [...habitItems, ...videoItems].slice(0, 3);
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

export function buildDashboardModulesVM(state = {}) {
  const goals = normalizeGoals(state.goals);
  const remainingHabitTurns = calcRemainingHabitTurns(state.habitProgress);
  const openVideoTasks = calcOpenVideoTasks(state.videoTasks);
  const accountBalances = (Array.isArray(state.accountBalances) ? state.accountBalances : [])
    .map((item) => normalizeAccountBalanceItem(item))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 6);

  return {
    video: {
      count: openVideoTasks,
      subtitle: t("dashboard.modules.video.subtitle", ""),
    },
    goals: {
      count: goals.length,
      subtitle: t("dashboard.modules.goals.subtitle", ""),
    },
    motivation: {
      streak: Number(state?.motivation?.streak || 0),
      xp: Number(state?.motivation?.totalXp || 0),
      level: Number(state?.motivation?.level || 1),
      subtitle: t("dashboard.modules.motivation.subtitle", ""),
      remainingHabitTurns,
    },
    accounts: {
      title: t("dashboard.modules.accounts.title", "Số dư tài khoản"),
      empty: t("dashboard.modules.accounts.empty", "Chưa có dữ liệu số dư tài khoản."),
      items: accountBalances,
    },
  };
}

export function buildDashboardCommandCenterVM(state = {}, now = new Date()) {
  return {
    hero: buildDashboardHeroVM(state, now),
    modules: buildDashboardModulesVM(state),
    priorityItems: buildPriorityItems(state),
  };
}
