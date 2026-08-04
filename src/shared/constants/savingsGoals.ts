export const SAVINGS_GOAL_ICON_KEYS = [
  "house",
  "car",
  "phone",
  "travel",
  "education",
  "wedding",
  "emergency",
  "custom",
] as const;

export type SavingsGoalIconKey = (typeof SAVINGS_GOAL_ICON_KEYS)[number];

export const SAVINGS_GOAL_ICON_LABELS: Record<SavingsGoalIconKey, string> = {
  house: "Nhà",
  car: "Xe",
  phone: "Điện thoại",
  travel: "Du lịch",
  education: "Học tập",
  wedding: "Cưới hỏi",
  emergency: "Dự phòng",
  custom: "Khác",
};

export function normalizeSavingsGoalIconKey(value: unknown): SavingsGoalIconKey {
  const key = String(value || "").trim().toLowerCase();
  return (SAVINGS_GOAL_ICON_KEYS as readonly string[]).includes(key)
    ? (key as SavingsGoalIconKey)
    : "custom";
}
