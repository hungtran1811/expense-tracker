import { callNetlifyFunction } from "./netlifyClient.js";

const GOAL_SUGGEST_TIMEOUT_MS = 15000;

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const goal = item?.goal || {};
      const habit = item?.habit || {};
      const weeklyPlan = item?.weeklyPlan || {};
      const goalTitle = String(goal?.title || "").trim() || "mục tiêu chính";
      const weeklyPrioritiesRaw = (Array.isArray(weeklyPlan?.topPriorities) ? weeklyPlan.topPriorities : [])
        .map((line) => String(line || "").trim())
        .filter(Boolean)
        .slice(0, 3);
      const weeklyPriorities =
        weeklyPrioritiesRaw.length >= 3
          ? weeklyPrioritiesRaw
          : [
              weeklyPrioritiesRaw[0] || `Hoàn thành mốc quan trọng cho ${goalTitle}`,
              weeklyPrioritiesRaw[1] || "Khóa lịch làm việc cố định cho tuần này",
              weeklyPrioritiesRaw[2] || "Rà soát và chốt đầu việc còn mở trước cuối tuần",
            ];
      return {
        goal: {
          title: goalTitle,
          area: String(goal?.area || "ca-nhan").trim() || "ca-nhan",
          period: String(goal?.period || "month").trim() || "month",
          targetValue: Number(goal?.targetValue || 1),
          unit: String(goal?.unit || "lần").trim() || "lần",
          dueDate: String(goal?.dueDate || "").trim(),
          priority: String(goal?.priority || "medium").trim() || "medium",
          note: String(goal?.note || "").trim(),
        },
        habit: {
          name: String(habit?.name || "").trim(),
          period: String(habit?.period || "day").trim() || "day",
          targetCount: Number(habit?.targetCount || 1),
          xpPerCheckin: Number(habit?.xpPerCheckin || 10),
        },
        weeklyPlan: {
          focusTheme: String(weeklyPlan?.focusTheme || "").trim() || `Tập trung hoàn thành ${goalTitle}`,
          topPriorities: weeklyPriorities,
          actionCommitments: String(weeklyPlan?.actionCommitments || "").trim() || "Mỗi ngày chốt ít nhất một đầu việc ưu tiên.",
        },
        reason: String(item?.reason || "").trim(),
      };
    })
    .filter((item) => item.goal.title && item.habit.name)
    .slice(0, 3);
}

export async function getGoalSuggestions(payload = {}, options = {}) {
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs || GOAL_SUGGEST_TIMEOUT_MS));
  const data = await callNetlifyFunction("ai-goal-suggest", payload || {}, {
    timeoutMs,
  });

  const suggestions = normalizeOptions(data?.options);
  if (!suggestions.length) {
    throw new Error("Không nhận được bundle mục tiêu hợp lệ.");
  }

  return {
    options: suggestions,
    model: String(data?.model || "gemini-3-flash-latest"),
    promptVersion: String(data?.promptVersion || "3.1.0"),
  };
}
