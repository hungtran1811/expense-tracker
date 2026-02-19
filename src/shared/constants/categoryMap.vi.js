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

export function toCategoryLabelVi(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Khác";
  return CATEGORY_LABEL_MAP[value] || value;
}

export function toCategoryValueDb(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Other";
  return CATEGORY_VALUE_MAP[value] || value;
}

export function localizeCategoryList(list = []) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    categoryLabel: toCategoryLabelVi(item?.category),
  }));
}
