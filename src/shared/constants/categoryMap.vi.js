export const CATEGORY_OPTIONS = [
  { value: "Food & Drink", label: "Ăn uống" },
  { value: "Coffee", label: "Cà phê" },
  { value: "Personal", label: "Cá nhân" },
  { value: "Rent", label: "Nhà ở" },
  { value: "Fitness", label: "Thể thao" },
  { value: "Groceries", label: "Đi chợ" },
  { value: "Transport", label: "Di chuyển" },
  { value: "Healthcare", label: "Sức khỏe" },
  { value: "Lending", label: "Cho vay" },
  { value: "Other", label: "Khác" },
];

const CATEGORY_LABEL_MAP = CATEGORY_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const CATEGORY_VALUE_MAP = CATEGORY_OPTIONS.reduce((acc, item) => {
  acc[item.label] = item.value;
  return acc;
}, {});

const CATEGORY_ALIAS_MAP = Object.freeze({
  "an uong": "Food & Drink",
  "food drink": "Food & Drink",
  "food and drink": "Food & Drink",
  food: "Food & Drink",
  "ca phe": "Coffee",
  coffee: "Coffee",
  "ca nhan": "Personal",
  personal: "Personal",
  "nha o": "Rent",
  rent: "Rent",
  housing: "Rent",
  "the thao": "Fitness",
  fitness: "Fitness",
  sport: "Fitness",
  gym: "Fitness",
  "di cho": "Groceries",
  groceries: "Groceries",
  grocery: "Groceries",
  "di chuyen": "Transport",
  transport: "Transport",
  travel: "Transport",
  "suc khoe": "Healthcare",
  healthcare: "Healthcare",
  health: "Healthcare",
  "cho vay": "Lending",
  lending: "Lending",
  loan: "Lending",
  khac: "Other",
  other: "Other",
  misc: "Other",
  miscellaneous: "Other",
});

function normalizeCategoryKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toCategoryValueDb(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Other";

  if (CATEGORY_LABEL_MAP[value]) return value;
  if (CATEGORY_VALUE_MAP[value]) return CATEGORY_VALUE_MAP[value];

  const normalized = normalizeCategoryKey(value);
  return CATEGORY_ALIAS_MAP[normalized] || value;
}

export function toCategoryLabelVi(raw) {
  const canonicalValue = toCategoryValueDb(raw);
  return CATEGORY_LABEL_MAP[canonicalValue] || String(raw || "").trim() || "Khác";
}

export function localizeCategoryList(list = []) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    categoryLabel: toCategoryLabelVi(item?.category),
  }));
}
