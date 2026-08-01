/** Parse quick amount input: 50tr, 1.5tr, 500k, 1.200.000, 1200000 */
export function parseAmountInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  let text = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/đ|d|vnd/g, "");
  if (!text) return null;

  let multiplier = 1;
  if (text.endsWith("tr") || text.endsWith("m")) {
    multiplier = 1_000_000;
    text = text.replace(/(tr|m)$/i, "");
  } else if (text.endsWith("k")) {
    multiplier = 1_000;
    text = text.slice(0, -1);
  }

  // 1.200.000 or 1,200,000 → strip thousand separators when both . and , appear carefully
  if (/^\d{1,3}([.]\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}([,]\d{3})+([.]\d+)?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else {
    text = text.replace(/,/g, ".");
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * multiplier);
}
