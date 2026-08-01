export function formatCurrency(amount: number = 0): string {
  const value = Math.round(Number(amount || 0));
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${formatted}₫`;
}
