export type ExpenseTemplate = {
  id: string;
  label: string;
  categoryKey: string;
  /** Match scope by name fragment (case-insensitive). */
  scopeHint: string;
  moneyOwner: "personal" | "mother";
  note: string;
};

/** Built-in quick expense templates (no Firestore required). */
export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    id: "food",
    label: "Ăn uống",
    categoryKey: "food",
    scopeHint: "sinh hoạt",
    moneyOwner: "personal",
    note: "Ăn uống",
  },
  {
    id: "fuel",
    label: "Xăng xe",
    categoryKey: "transport",
    scopeHint: "sinh hoạt",
    moneyOwner: "personal",
    note: "Xăng",
  },
  {
    id: "grocery",
    label: "Đi chợ",
    categoryKey: "food",
    scopeHint: "sinh hoạt",
    moneyOwner: "personal",
    note: "Đi chợ",
  },
  {
    id: "personal",
    label: "Cá nhân",
    categoryKey: "personal",
    scopeHint: "cá nhân",
    moneyOwner: "personal",
    note: "",
  },
];
